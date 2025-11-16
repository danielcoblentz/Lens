"""
Required Environment Variables:
- CHUNKS_TABLE: DynamoDB table name for storing document chunks/embeddings
- SESSIONS_TABLE: DynamoDB table name for session records
- OPENAI_API_KEY: OpenAI API key for embeddings and LLM calls
"""

import json
import boto3
import os
import math
from boto3.dynamodb.conditions import Key
from openai import OpenAI

client = OpenAI()

dynamodb = boto3.resource("dynamodb")
chunks_table = dynamodb.Table(os.environ["CHUNKS_TABLE"])
sessions_table = dynamodb.Table(os.environ["SESSIONS_TABLE"])



# convert user query into an embedding vector
def embed_text(text):  
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text)
    return response.data[0].embedding


# compute cosine similarity
def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot / (norm_a * norm_b + 1e-9)


#main lambda logic
def lambda_handler(event, context):
    body = json.loads(event["body"])
    session_id = body["sessionId"]
    user_query = body["query"]

    # check if the session exists
    session = sessions_table.get_item(Key={"sessionId": session_id})
    if "Item" not in session:
        return {
            "statusCode": 404,
            "body": json.dumps({"error": "Invalid sessionId"})}

    # generate embeddings for the user query
    query_embedding = embed_text(user_query)

    # get all chunks from DynamoDB
    response = chunks_table.query(
        KeyConditionExpression=Key("sessionId").eq(session_id))
    chunks = response.get("Items", [])

    if not chunks:
        return {
            "statusCode": 404,
            "body": json.dumps({"error": "No chunks found"})
        }

    #  score each chunk with cosine similarity
    scored = []
    for item in chunks:
        embedding = item.get("embedding")
        if embedding:
            sim = cosine_similarity(query_embedding, embedding)
            scored.append((sim, item["text"]))

    #  take the top 3 most similar chunks
    top_k = sorted(scored, key=lambda x: x[0], reverse=True)[:3]

    context = "\n\n---\n\n".join(chunk for _, chunk in top_k)

    # build the final RAG prompt
    prompt = f"""
You are a legal assistant. Use only the provided contract text to answer.

CONTEXT:
{context}

USER QUESTION:
{user_query}

Give a precise legal answer grounded strictly in the document.
"""

    #  GPT for final answer
    llm_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You answer using only the provided context."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=400
    )

    answer = llm_response.choices[0].message.content

    # return answer back to user
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "sessionId": session_id,
            "answer": answer
        })
    }
