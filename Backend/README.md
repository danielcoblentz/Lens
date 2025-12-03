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
  - LlamaParse
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

## Next steps / Roadmap (prioritized)

1. Security & secrets (immediate)
   - Remove any committed API keys, rotate exposed keys now.
   - Ensure `.env` is in `.gitignore` and run:
     - git restore --staged .env
     - git rm --cached .env
     - commit and push.
   - Store secrets in AWS Parameter Store / Secrets Manager and reference from Lambda env vars.

2. Source control & infra
   - Export Lambda code from the Console and commit each function under:
     - backend/llama_get/
     - backend/llama_parse/
     - backend/llama_query/
   - Add an IaC spec (SAM/Serverless/CDK/Terraform) to deploy Lambdas, roles, S3, DynamoDB, API Gateway.
   - Add a `.env.example` (no secrets) to document required variables.

3. Function hardening
   - llama_get: validate file type/size, set reasonable presigned URL expiry, store session status "uploaded" on presign.
   - llama_parse: add idempotency (skip if chunks exist), set session status transitions (processing → ready | failed), add retry/backoff for external calls.
   - llama_query: allow configurable top_k and similarity threshold, handle empty/low-confidence results.

4. Performance & cost
   - Batch embedding requests where API supports batching.
   - Limit chunk count and max token sizes to control embedding/LLM cost.
   - Consider moving similarity search to a vector DB (Pinecone/Redis/Weaviate) for scale.

5. Observability & monitoring
   - Add structured logs and metrics (chunk count, embedding calls, LLM token usage).
   - Configure CloudWatch alarms on errors, high durations, or failed parsing jobs.
   - Add distributed tracing (X-Ray) if useful.

6. Testing & CI/CD
   - Add unit tests for handlers and utilities (pytest).
   - Add integration tests that run locally against a mocked S3/DynamoDB (moto) or a local stack (SAM).
   - Add a GitHub Actions workflow to lint, run tests, and deploy via IaC.

7. QA / Acceptance criteria
   - End-to-end flow: presign → upload → parse → query produces grounded answers for sample doc.
   - No secrets present in git history.
   - Environment variables documented and set in Lambda console or IaC.
   - Basic observability and alerts configured.
   - Repeatable deploy via IaC.

## Minimal checklist to mark "done"
- [ ] All Lambda source files committed and code-reviewed
- [ ] IaC template added and can deploy all resources
- [ ] Secrets moved to Secrets Manager / Parameter Store, `.env` removed from repo
- [ ] Parsing idempotency and error handling implemented
- [ ] Query supports configurable top_k and fallback
- [ ] CI pipeline runs tests and can deploy to a test environment
- [ ] Monitoring and alarms configured

## Frontend plan & API contract

Pages the frontend should implement (minimal viable set)
- Home / Dashboard
  - List sessions (status, file name, created_at)
  - Create new upload session button
- Upload page / Modal
  - Select file, request presigned upload URL, upload file directly to S3
  - Show session id and immediate upload progress
- Upload status / Session detail
  - Shows session status (created → uploaded → processing → ready | error)
  - Show chunk count, metadata, and ability to trigger re-process
- Document viewer / Explorer
  - Paginated/sectioned view of parsed sections and their text
  - Link each chunk/section to cite in answers
- Q&A / Chat page
  - Input user question, display answer and citations (sections returned)
  - Allow toggling top_k or similarity threshold
- Settings
  - API endpoints, model selection, and logout if auth is used

Backend API endpoints (examples)
- GET /presign?filename={name}
  - Response: { session_id, upload_url, s3_key, expires_in }
- GET /sessions
  - Response: [{ session_id, file_name, status, created_at, chunk_count }]
- GET /sessions/{session_id}
  - Response: { session_id, file_name, status, created_at, chunk_count, error }
- POST /query
  - Body: { session_id, query, top_k? }
  - Response: { session_id, answer, citations: [{ chunkId, score }], raw?: { llm_response } }
- POST /reprocess
  - Body: { session_id }
  - Response: { status: "processing" }

Integration patterns
- Presigned upload: frontend calls GET /presign → receives upload_url → PUT file to S3 directly.
- Parse completion: either poll GET /sessions/{id} until status == READY_FOR_QUERY, or implement a webhook/WS notification to frontend.
- Query flow: POST /query with session_id and question; show loading spinner until response.

Frontend-specific environment variables
- REACT_APP_API_BASE_URL or VITE_API_BASE_URL (pointing to your API Gateway)
- REACT_APP_DEFAULT_TOP_K
- Optional: REACT_APP_COGNITO_POOL_ID (if using auth)

Security & UX notes
- Do uploads directly to S3 using the presigned URL (no file proxying through backend).
- Keep presigned expiry short (e.g., 10–60 minutes).
- Validate file size/type client-side before requesting a presign.
- Show clear session states and allow retry on failure.

Acceptance criteria for the frontend
- Upload a PDF via presigned URL and see session created.
- Frontend shows parse progress and session becomes "ready".
- Ask a question about the document and receive a grounded answer with citations.
- No API keys or secrets are stored in client bundle; only API base URL and non-sensitive flags.

## Committing & Git checklist (quick)

Before committing, verify what will be included and ensure no secrets are tracked.

Check staged files:
```
git diff --name-only --cached
```

Quick scan staged files for obvious secrets (API key prefixes like "sk-"):
```
git diff --cached | grep -E "sk-|OPENAI_API_KEY" || true
```

If you accidentally staged something you don't want to commit:
- Unstage everything (safe):
```
git restore --staged .
```
- Or unstage specific files:
```
git restore --staged path/to/file
```

If you want to discard local changes (restore from HEAD):
```
git restore path/to/file
```

If a file was deleted by accident (restore the deleted file):
```
git restore --source=HEAD -- Backend/README.md
# or
git restore ../Backend/README.md
```

If .env or other secrets are tracked, remove them from the index (keeps local file):
```
git rm --cached .env
git commit -m "Remove .env from tracking"
# rotate any exposed keys immediately if they were previously committed
```

To commit only the staged frontend skeleton (if staged files are correct):
```
git commit -m "Add frontend app skeleton"
git push
```

Notes:
- Always run `git diff --name-only --cached` to confirm what will be committed.
- If you discover any secret in git history, rotate the secret immediately and purge it from history (e.g., BFG or git filter-branch).
- Recommended workflow: stage only the files you intend to commit (use `git add <file>`), scan with the commands above, then commit.