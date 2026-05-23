"""LlamaQuery: RAG over a session's chunks.

Flow:
  1. Validate the request and load the session record.
  2. Embed the question.
  3. Query DynamoDB for all chunks belonging to the session.
  4. Rank by cosine similarity and keep the top K.
  5. Send the top chunks + question to the LLM.
  6. Return the answer plus a small bundle of latency metrics.
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from openai import OpenAI

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
CHUNKS_TABLE = os.environ["CHUNKS_TABLE"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
DEFAULT_TOP_K = int(os.environ.get("DEFAULT_TOP_K", "5"))
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "600"))

dynamodb = boto3.resource("dynamodb")
sessions_table = dynamodb.Table(SESSIONS_TABLE)
chunks_table = dynamodb.Table(CHUNKS_TABLE)

# Lazily construct the OpenAI client so module import doesn't require an API
# key (helps Lambda cold start and keeps unit tests trivial to set up).
_openai_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI()
    return _openai_client

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

SYSTEM_PROMPT = "You answer using only the provided context."

USER_PROMPT_TEMPLATE = """You are a legal contract analyst. Extract and explain the relevant clause.

CONTRACT EXCERPTS:
{context}

QUESTION: {question}

INSTRUCTIONS:
- Quote relevant language directly from the contract
- Include key terms: parties, dates, amounts, conditions, obligations
- Be comprehensive but grounded only in the provided text

ANSWER:"""


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {"statusCode": status_code, "headers": CORS_HEADERS, "body": json.dumps(body)}


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity. Returns 0 for either zero-magnitude input."""
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(y * y for y in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def embed_query(text: str) -> list[float]:
    response = get_openai_client().embeddings.create(model=EMBEDDING_MODEL, input=text)
    return response.data[0].embedding


def rank_chunks(
    query_embedding: list[float],
    chunks: list[dict[str, Any]],
    top_k: int,
) -> list[tuple[float, str]]:
    """Score each chunk by cosine similarity and keep the top K."""
    scored: list[tuple[float, str]] = []
    for chunk in chunks:
        embedding = chunk.get("embedding")
        if not embedding:
            continue
        # DynamoDB stores numbers as Decimal — cast back to float for math.
        emb = [float(v) for v in embedding]
        scored.append((cosine_similarity(query_embedding, emb), chunk["text"]))
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[:top_k]


def build_prompt(top_chunks: list[tuple[float, str]], question: str) -> str:
    context = "\n\n---\n\n".join(text for _, text in top_chunks)
    return USER_PROMPT_TEMPLATE.format(context=context, question=question)


def call_llm(prompt: str) -> str:
    response = get_openai_client().chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=LLM_MAX_TOKENS,
    )
    return response.choices[0].message.content or ""


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    start = time.time()

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    session_id = body.get("sessionId")
    question = body.get("query")
    top_k = int(body.get("topK", DEFAULT_TOP_K))

    if not session_id or not question:
        return _response(400, {"error": "sessionId and query are required"})

    session = sessions_table.get_item(Key={"sessionId": session_id}).get("Item")
    if not session:
        return _response(404, {"error": "Invalid sessionId"})

    if session.get("status") != "READY_FOR_QUERY":
        return _response(
            409,
            {"error": f"Session not ready (status={session.get('status')})"},
        )

    metrics: dict[str, float] = {}

    t = time.time()
    query_embedding = embed_query(question)
    metrics["embedding_time_ms"] = round((time.time() - t) * 1000)

    chunks = chunks_table.query(
        KeyConditionExpression=Key("sessionId").eq(session_id),
    ).get("Items", [])

    if not chunks:
        return _response(404, {"error": "No chunks found for session"})

    t = time.time()
    top_chunks = rank_chunks(query_embedding, chunks, top_k)
    metrics["similarity_search_time_ms"] = round((time.time() - t) * 1000)
    metrics["chunks_searched"] = len(chunks)
    metrics["top_chunk_similarity"] = (
        round(top_chunks[0][0], 4) if top_chunks else 0.0
    )

    t = time.time()
    answer = call_llm(build_prompt(top_chunks, question))
    metrics["llm_time_ms"] = round((time.time() - t) * 1000)
    metrics["total_time_ms"] = round((time.time() - start) * 1000)

    logger.info("answered session=%s in %sms", session_id, metrics["total_time_ms"])

    return _response(
        200,
        {"sessionId": session_id, "answer": answer, "metrics": metrics},
    )
