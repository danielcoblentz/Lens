"""LlamaParse: download a PDF, chunk it, embed each chunk, persist to DynamoDB.

Triggered by an S3 ObjectCreated event on the uploads/ prefix. The session
status is updated as we progress:

    AWAITING_UPLOAD -> PROCESSING -> READY_FOR_QUERY
                                  -> ERROR (on any failure)

On retry (S3 can deliver the same event more than once) the function is
idempotent: if chunks already exist for the session we skip re-embedding.
"""

from __future__ import annotations

import json
import logging
import os
import traceback
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from openai import OpenAI
from PyPDF2 import PdfReader

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET_NAME = os.environ["BUCKET_NAME"]
SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
CHUNKS_TABLE = os.environ["CHUNKS_TABLE"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "100"))

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
sessions_table = dynamodb.Table(SESSIONS_TABLE)
chunks_table = dynamodb.Table(CHUNKS_TABLE)

# Lazily construct the OpenAI client on first use so module import stays cheap
# (helps Lambda cold start) and tests can patch it without an API key.
_openai_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI()
    return _openai_client


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    """Split text into overlapping chunks of up to chunk_size characters.

    The algorithm:
      1. Split on paragraph boundaries (\\n\\n).
      2. Greedily pack paragraphs into the current chunk until the next one
         would overflow chunk_size.
      3. Carry the last chunk_overlap chars of the previous chunk forward so
         context survives boundaries.
      4. If a single paragraph is longer than chunk_size, hard-slice it with
         the same overlap.

    This is intentionally less clever than a fully recursive splitter — the
    behaviour is easy to reason about and good enough for legal contracts,
    which are paragraph-heavy.
    """
    text = text.strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""

    def flush() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for para in paragraphs:
        # Single paragraph too big — hard-slice with overlap.
        if len(para) > chunk_size:
            flush()
            start = 0
            while start < len(para):
                end = min(start + chunk_size, len(para))
                chunks.append(para[start:end].strip())
                if end == len(para):
                    break
                start = end - chunk_overlap
            continue

        joined = f"{current}\n\n{para}" if current else para
        if len(joined) <= chunk_size:
            current = joined
        else:
            flush()
            # Seed the next chunk with overlap from the previous one.
            if chunks and chunk_overlap > 0:
                current = f"{chunks[-1][-chunk_overlap:]} {para}"
            else:
                current = para

    flush()
    return chunks


def extract_pdf_text(pdf_path: str) -> str:
    reader = PdfReader(pdf_path)
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(p for p in pages if p)


def embed(text: str) -> list[float]:
    response = get_openai_client().embeddings.create(model=EMBEDDING_MODEL, input=text)
    return response.data[0].embedding


def _update_status(session_id: str, status: str, error: str | None = None) -> None:
    expression = "SET #s = :s"
    values: dict[str, Any] = {":s": status}
    names = {"#s": "status"}
    if error is not None:
        expression += ", #e = :e"
        values[":e"] = error
        names["#e"] = "error"
    sessions_table.update_item(
        Key={"sessionId": session_id},
        UpdateExpression=expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def _has_existing_chunks(session_id: str) -> bool:
    result = chunks_table.query(
        KeyConditionExpression=Key("sessionId").eq(session_id),
        Limit=1,
    )
    return bool(result.get("Items"))


def _session_id_from_key(key: str) -> str:
    """uploads/<sessionId>.pdf -> <sessionId>."""
    return key.rsplit("/", 1)[-1].removesuffix(".pdf")


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    record = event["Records"][0]
    bucket = record["s3"]["bucket"]["name"]
    key = record["s3"]["object"]["key"]
    session_id = _session_id_from_key(key)

    logger.info("processing session=%s key=%s", session_id, key)

    if _has_existing_chunks(session_id):
        logger.info("session %s already has chunks, skipping", session_id)
        return {
            "statusCode": 200,
            "body": json.dumps({"sessionId": session_id, "skipped": True}),
        }

    try:
        _update_status(session_id, "PROCESSING")

        local_path = f"/tmp/{session_id}.pdf"
        s3.download_file(bucket, key, local_path)

        text = extract_pdf_text(local_path)
        chunks = chunk_text(text)

        for index, chunk in enumerate(chunks):
            embedding = embed(chunk)
            chunks_table.put_item(
                Item={
                    "sessionId": session_id,
                    "chunkId": f"chunk_{index}",
                    "text": chunk,
                    "embedding": [Decimal(str(v)) for v in embedding],
                    "order": index,
                }
            )

        _update_status(session_id, "READY_FOR_QUERY")
        logger.info("session %s ready with %d chunks", session_id, len(chunks))

        return {
            "statusCode": 200,
            "body": json.dumps({"sessionId": session_id, "chunksCreated": len(chunks)}),
        }
    except Exception as exc:  # noqa: BLE001 — surface failures into the session.
        logger.exception("parse failed for session %s", session_id)
        _update_status(session_id, "ERROR", error=str(exc))
        return {
            "statusCode": 500,
            "body": json.dumps(
                {
                    "sessionId": session_id,
                    "error": str(exc),
                    "trace": traceback.format_exc(),
                }
            ),
        }
