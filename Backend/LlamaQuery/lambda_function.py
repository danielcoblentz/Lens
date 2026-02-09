import json
import boto3
import os
import math
import time
from boto3.dynamodb.conditions import Key
from openai import OpenAI

openai_client = OpenAI()
dynamodb_resource = boto3.resource("dynamodb")
chunks_table = dynamodb_resource.Table(os.environ["CHUNKS_TABLE"])
sessions_table = dynamodb_resource.Table(os.environ["SESSIONS_TABLE"])

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
}


def get_query_embedding(query_text):
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query_text
    )
    return response.data[0].embedding


def cosine_similarity(vec_a, vec_b):
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    return dot / (mag_a * mag_b + 1e-9)


def lambda_handler(event, context):
    start_time = time.time()
    metrics = {}

    body = json.loads(event["body"])
    session_id = body["sessionId"]
    question = body["query"]

    session = sessions_table.get_item(Key={"sessionId": session_id})
    if "Item" not in session:
        return {"statusCode": 404, "headers": CORS_HEADERS,
                "body": json.dumps({"error": "Invalid sessionId"})}

    # embed the question so we can compare against stored chunk embeddings
    embed_start = time.time()
    query_embedding = get_query_embedding(question)
    metrics["embedding_time_ms"] = round((time.time() - embed_start) * 1000)

    chunks_response = chunks_table.query(
        KeyConditionExpression=Key("sessionId").eq(session_id)
    )
    chunks = chunks_response.get("Items", [])

    if not chunks:
        return {"statusCode": 404, "headers": CORS_HEADERS,
                "body": json.dumps({"error": "No chunks found"})}

    # rank chunks by cosine similarity to the question
    search_start = time.time()
    scored = []
    for chunk in chunks:
        embedding = chunk.get("embedding")
        if embedding:
            emb_floats = [float(v) for v in embedding]
            sim = cosine_similarity(query_embedding, emb_floats)
            scored.append((sim, chunk["text"]))
    metrics["similarity_search_time_ms"] = round((time.time() - search_start) * 1000)
    metrics["chunks_searched"] = len(chunks)

    # grab the top 5 most relevant chunks for the llm prompt
    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored[:5]
    context = "\n\n---\n\n".join(text for _, text in top_chunks)

    prompt = f"""You are a legal contract analyst. Extract and explain the relevant clause.

CONTRACT EXCERPTS:
{context}

QUESTION: {question}

INSTRUCTIONS:
- Quote relevant language directly from the contract
- Include key terms: parties, dates, amounts, conditions, obligations
- Be comprehensive but grounded only in the provided text

ANSWER:"""

    llm_start = time.time()
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You answer using only the provided context."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=600
    )
    metrics["llm_time_ms"] = round((time.time() - llm_start) * 1000)

    answer = response.choices[0].message.content
    metrics["total_time_ms"] = round((time.time() - start_time) * 1000)
    metrics["top_chunk_similarity"] = round(top_chunks[0][0], 4) if top_chunks else 0

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({
            "sessionId": session_id,
            "answer": answer,
            "metrics": metrics
        })
    }
