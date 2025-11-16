"""
Security note:
- Do not print/log environment variables or secrets.
- Required env vars for this function:
  - BUCKET_NAME: S3 bucket for PDFs
  - SESSIONS_TABLE: DynamoDB table for sessions
  - CHUNKS_TABLE: DynamoDB table for chunks/embeddings
  - OPENAI_API_KEY: used by OpenAI client (set in Lambda env, never logged)
"""
import json
import boto3
import os
from PyPDF2 import PdfReader
from openai import OpenAI

# AWS clients
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
CHUNKS_TABLE = os.environ["CHUNKS_TABLE"]
BUCKET_NAME = os.environ["BUCKET_NAME"]

sessions_table = dynamodb.Table(SESSIONS_TABLE)
chunks_table = dynamodb.Table(CHUNKS_TABLE)

client = OpenAI()


# Split extracted document text into semantically useful chunks
def chunk_text(text, max_chars=800):  
    chunks = []
    current = ""

    for paragraph in text.split("\n\n"):
        if len(current) + len(paragraph) < max_chars:
            current += paragraph + "\n\n"
        else:
            chunks.append(current.strip())
            current = paragraph + "\n\n"

    if current.strip():
        chunks.append(current.strip())

    return chunks
# Generate embedding for chunk text using OpenAI
def embed_text(text):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text)
    return response.data[0].embedding

def lambda_handler(event, context):
    # Extract S3 file info
    record = event["Records"][0]
    bucket = record["s3"]["bucket"]["name"]
    key = record["s3"]["object"]["key"]

    session_id = key.split("/")[-1].replace(".pdf", "")
    local_path = f"/tmp/{session_id}.pdf"

    # download PDF to Lambda temp storage
    s3.download_file(bucket, key, local_path)

    #  extract text from PDF
    reader = PdfReader(local_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    #  chunk text
    chunks = chunk_text(full_text)

    #  embed each chunk then save to DynamoDB
    for i, chunk in enumerate(chunks):
        embedding = embed_text(chunk)

        chunks_table.put_item(
            Item={
                "sessionId": session_id,
                "chunkId": f"chunk_{i}",
                "text": chunk,
                "embedding": embedding,
                "order": i
            }
        )

    # update session 
    sessions_table.update_item(
        Key={"sessionId": session_id},
        UpdateExpression="SET #s = :status",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":status": "READY_FOR_QUERY"}
    )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "sessionId": session_id,
            "chunksCreated": len(chunks)
        })
    }
