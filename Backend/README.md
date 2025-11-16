## Architecture

Components:
- llama_get
  - handler.py: generate S3 presigned upload URLs
  - create a session record in DynamoDB (see session schema below)
  - requirements.txt: minimal deps (e.g., boto3, uuid)
- llama_parse
  - download PDF from S3
  - parse text and sections
  - generate embeddings
  - write results to DynamoDB (and/or a vector store)
- llama_query
  - retrieve session data
  - search embeddings
  - call an LLM
  - return an answer (with optional citations/sections)


## Directory Layout

- llama_get/
  - handler.py
  - model.py (session schema)
  - requirements.txt
- llama_parse/
  - code to download, parse, chunk, embed, and persist results
- llama_query/
  - code to retrieve data, search embeddings, call LLM, and format answers

## Prerequisites

- Python 3.10+ (recommended)
- AWS account with:
  - S3 bucket for uploads
  - DynamoDB table(s) for session and/or chunk storage
  - IAM roles/policies for Lambda access
- Embeddings/LLM provider (e.g., AWS Bedrock or OpenAI), as applicable
- boto3 and other listed requirements per service

## Setup

- Install dependencies in each service folder:
  - cd llama_get && pip install -r requirements.txt
  - cd llama_parse && pip install -r requirements.txt
  - cd llama_query && pip install -r requirements.txt

- Configure environment variables (per function):
  - AWS_REGION
  - S3_BUCKET
  - SESSIONS_TABLE
  - CHUNKS_TABLE
  - OPENAI_API_KEY
  - LLM_MODEL (e.g., gpt-4o-mini)
  - EMBEDDING_MODEL (e.g., text-embedding-3-small)

**Environment Variable Management:**
- Local: Copy `.env.example` → `.env` and fill in actual values
- `.env` is git-ignored for security
- Lambda: Set these in AWS Console → Lambda → Configuration → Environment variables for each function
  - LlamaGet needs: S3_BUCKET, SESSIONS_TABLE
  - LlamaParse needs: S3_BUCKET, SESSIONS_TABLE, CHUNKS_TABLE, OPENAI_API_KEY, EMBEDDING_MODEL
  - LlamaQuery needs: SESSIONS_TABLE, CHUNKS_TABLE, OPENAI_API_KEY, LLM_MODEL

**Variable Name Mapping:**
- `.env` uses: S3_BUCKET, SESSIONS_TABLE, CHUNKS_TABLE
- Ensure Lambda environment variables match exactly (no quotes, consistent naming)

Note: Never commit `.env` or API keys to version control.

## Data Model (DynamoDB)

sessions (primary):
- session_id (PK, string)
- status (e.g., created | processing | ready | error)
- file_name
- s3_key
- created_at, updated_at
- doc_meta (optional)
- chunk_count (optional)
- error (optional)

You may maintain a separate table or index for chunks/embeddings.

## Workflows

Upload:
1) Call the presign endpoint to create a session and receive a presigned upload URL.
2) Upload the PDF to S3 using the returned URL.
3) The parse function processes the file and updates the session status to ready.

Query:
1) Call the query endpoint with { session_id, question }.
2) The query function retrieves chunks/embeddings, searches, calls the LLM, and returns an answer.

## Example API Shapes (if fronted by API Gateway)

- GET /presign?filename=my.pdf
  - Response: { session_id, upload_url, s3_key, expires_in }
- POST /query
  - Body: { session_id: "abc123", question: "What is the termination clause?" }
  - Response: { answer: "...", citations: [{ section_id, score }], session_id }

Note: Exact routes/payloads may vary based on your infra setup.

## Deployment

Use your preferred tooling (SAM, Serverless Framework, Terraform, CDK):
- Package and deploy each function with required IAM permissions.
- Configure triggers:
  - llama_get behind API Gateway (for presigned URL and session creation)
  - llama_parse via S3 event or async orchestration
  - llama_query behind API Gateway (for Q&A)
- Set environment variables for each function.

## Local Development & Testing

- Unit test handlers locally with your runtime (e.g., pytest, local invokes).
- For presign URL testing: invoke llama_get.handler with a filename input and test S3 upload via curl.
- For parsing: simulate an S3 event or call the parse code with a local file.
- For querying: supply a session_id that has processed chunks/embeddings.

## Notes

- Ensure presigned URLs have reasonable expiry and restricted permissions.
- Validate file types and sizes before upload.
- Log minimally sensitive data; avoid storing raw PII when possible.