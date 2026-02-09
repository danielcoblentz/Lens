import json
import boto3
import os
from decimal import Decimal
from PyPDF2 import PdfReader
from openai import OpenAI

s3_client = boto3.client("s3")
dynamodb_resource = boto3.resource("dynamodb")

sessions_table = dynamodb_resource.Table(os.environ["SESSIONS_TABLE"])
chunks_table = dynamodb_resource.Table(os.environ["CHUNKS_TABLE"])
pdf_bucket_name = os.environ["BUCKET_NAME"]

openai_client = OpenAI()


def recursive_chunk_text(text, chunk_size=800, chunk_overlap=100, separators=None):
    """
    split text using hierarchical separators: paragraphs -> lines -> sentences -> words.
    each level preserves more semantic meaning than fixed-size splitting.
    overlap between chunks maintains context at boundaries.
    """
    if separators is None:
        separators = ["\n\n", "\n", ". ", " "]

    if len(text) <= chunk_size:
        return [text.strip()] if text.strip() else []

    chosen_separator = separators[-1]
    for sep in separators:
        if sep in text:
            chosen_separator = sep
            break

    parts = text.split(chosen_separator)
    chunks = []
    current_chunk = ""

    for part in parts:
        part_with_sep = part + chosen_separator if chosen_separator != " " else part + " "

        if len(current_chunk) + len(part_with_sep) <= chunk_size:
            current_chunk += part_with_sep
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())

            if len(part_with_sep) > chunk_size:
                remaining_separators = separators[separators.index(chosen_separator) + 1:]
                if remaining_separators:
                    sub_chunks = recursive_chunk_text(part, chunk_size, chunk_overlap, remaining_separators)
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                else:
                    for i in range(0, len(part), chunk_size - chunk_overlap):
                        chunks.append(part[i:i + chunk_size].strip())
                    current_chunk = ""
            else:
                if chunks and chunk_overlap > 0:
                    overlap_text = chunks[-1][-chunk_overlap:]
                    current_chunk = overlap_text + " " + part_with_sep
                else:
                    current_chunk = part_with_sep

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def generate_embedding(text):
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding


def lambda_handler(event, context):
    s3_event = event["Records"][0]
    source_bucket = s3_event["s3"]["bucket"]["name"]
    uploaded_key = s3_event["s3"]["object"]["key"]

    file_name = uploaded_key.split("/")[-1]
    session_id = file_name.replace(".pdf", "")

    local_path = f"/tmp/{session_id}.pdf"
    s3_client.download_file(source_bucket, uploaded_key, local_path)

    pdf_reader = PdfReader(local_path)
    extracted_text = ""
    for page in pdf_reader.pages:
        page_text = page.extract_text()
        if page_text:
            extracted_text += page_text + "\n"

    text_chunks = recursive_chunk_text(extracted_text, chunk_size=800, chunk_overlap=100)

    for i, chunk_text in enumerate(text_chunks):
        embedding = generate_embedding(chunk_text)
        embedding_decimals = [Decimal(str(v)) for v in embedding]

        chunks_table.put_item(Item={
            "sessionId": session_id,
            "chunkId": f"chunk_{i}",
            "text": chunk_text,
            "embedding": embedding_decimals,
            "order": i
        })

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
            "chunksCreated": len(text_chunks)
        })
    }
