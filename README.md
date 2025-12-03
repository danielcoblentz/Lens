# Lens: Serverless Legal Document RAG on AWS

## Architecture
<p align="center">
  <img src="System_architecture/architecture.png" alt="Overall architecture diagram" width="100%" />
</p>

- Upload flow: LlamaGet issues a presigned URL, the React app uploads the PDF directly to S3, and an S3 event triggers LlamaParse to extract text, chunk it, and store embeddings in DynamoDB.
- Query flow: LlamaQuery retrieves the top chunks by cosine similarity, builds a legal-assistant prompt, and returns grounded answers via API Gateway to the frontend chat pane.
- Storage: raw PDFs in S3, session metadata and chunks/embeddings in DynamoDB. OpenAI handles both embeddings and generation.
- Networking: all calls are HTTPS via API Gateway; Lambdas require outbound internet for OpenAI.
- To learn more about this architecture, you can drop a link to your internal design doc or blog post here.

## Demo
<p align="center">
  <img src="docs/demo.gif" alt="Application demo" width="100%" />
</p>

_Add your architecture PNG and demo GIF/MP4 to make these full-width visuals._

## Features
- Chat playground: React client with PDF viewer (react-pdf) and a chat pane scaffolded for RAG answers.
- Chat history management: current chat persists in-browser state; extend to persist by sessionId when wiring the API.
- Serverless knowledge base: presigned upload to S3, embeddings and chunks persisted in DynamoDB, no servers to manage.
- Dynamic prompt management: legal-focused prompt lives in `backend/LlamaQuery/lambda_function.py` and can be overridden per deployment.

## Changing the default prompt dynamically
1) Open `backend/LlamaQuery/lambda_function.py`.
2) Update the `prompt` template and/or the system message passed to `chat.completions.create`.
3) Optionally read a `DEFAULT_PROMPT` env var and fall back to the current string.
4) Redeploy the LlamaQuery Lambda so all users receive the new prompt.

## Prerequisites
- Node.js >= 18 and npm (frontend uses Create React App).
- Python 3.10+ for packaging Lambdas; virtualenv recommended.
- AWS account with S3, DynamoDB, Lambda, API Gateway, and permissions to create S3 event notifications.
- OpenAI API key available to Lambdas as `OPENAI_API_KEY`.
- AWS CLI configured locally if you deploy from your machine.

## Config
### Supported regions
Works in any region with S3, DynamoDB, Lambda, and API Gateway. Pick a region with low latency to your users (e.g., `us-east-1`, `us-west-2`, `eu-west-1`). Ensure egress to OpenAI is allowed from your VPC (or run Lambdas without VPC attachment).

### Environment variables
- LlamaGet: `BUCKET_NAME`, `TABLE_NAME` (sessions table).
- LlamaParse: `BUCKET_NAME`, `SESSIONS_TABLE`, `CHUNKS_TABLE`, `OPENAI_API_KEY`.
- LlamaQuery: `SESSIONS_TABLE`, `CHUNKS_TABLE`, `OPENAI_API_KEY`, optional `DEFAULT_PROMPT` if you add it.

### Embedding and LLM configuration
Current models are hardcoded:
- Embeddings: `text-embedding-3-small` in `backend/LlamaParse/lambda_function.py` and `backend/LlamaQuery/lambda_function.py`.
- Generation: `gpt-4o-mini` in `backend/LlamaQuery/lambda_function.py`.
If you switch models after data is ingested, re-embed stored chunks to avoid mixing vector dimensions.

### Sample .env for local packaging
```
OPENAI_API_KEY=sk-xxxx
BUCKET_NAME=lens-uploads
TABLE_NAME=LensSessions
SESSIONS_TABLE=LensSessions
CHUNKS_TABLE=LensChunks
```
Keep `.env` out of version control.

## Installation
- Backend (per Lambda):
  - `python -m venv .venv && .\.venv\Scripts\activate`
  - Install deps into each function folder before zipping:
    - LlamaGet: uses `boto3` (available in Lambda), no extra deps.
    - LlamaParse: `pip install PyPDF2 openai -t backend/LlamaParse`.
    - LlamaQuery: `pip install -r backend/LlamaQuery/requirements.txt -t backend/LlamaQuery`.
- Frontend:
  - `cd frontend`
  - `npm install`

## Deploy
- Create resources: one S3 bucket for uploads, DynamoDB tables `LensSessions` (pk: `sessionId`) and `LensChunks` (pk: `sessionId`, sort key: `chunkId`).
- Package and deploy Lambdas:
  - LlamaGet behind API Gateway for `GET /presign` (returns `sessionId` + `uploadUrl`).
  - LlamaParse triggered by S3 `ObjectCreated` on `uploads/*`.
  - LlamaQuery behind API Gateway for `POST /query`.
- Set the environment variables above on each Lambda role; attach IAM policies for S3 get/put and DynamoDB read/write on the two tables.
- Enable CORS on API Gateway for your frontend origin.

## Test
- Presign: `curl "https://<api>/presign?filename=contract.pdf"` -> note `sessionId` and `uploadUrl`.
- Upload: `curl -X PUT -T ./sample.pdf -H "Content-Type: application/pdf" "<uploadUrl>"`.
- Parse: confirm the S3 event fires and DynamoDB `LensChunks` receives embeddings; session status should become `READY_FOR_QUERY`.
- Query: `curl -X POST "https://<api>/query" -H "Content-Type: application/json" -d '{"sessionId":"<id>","query":"What is the termination clause?"}'`.

## Running the frontend locally
- `cd frontend`
- `npm start`
- The UI supports local file selection + PDF viewing. Wire API calls in `src/pages/Home.js` (upload flow) and `src/components/chatBox.js` (answer display) to hit your deployed endpoints when ready.

## Example API shapes
- `GET /presign?filename=my.pdf` -> `{ sessionId, uploadUrl, s3Key, expiresIn }`
- `POST /query` with `{ sessionId, query }` -> `{ sessionId, answer, topChunks? }`
Adjust shapes as you add pagination, citations, or auth.
