# Lens

A serverless document analysis tool that lets users upload legal contracts
and ask questions about them using retrieval-augmented generation. Built
on AWS Lambda, DynamoDB, S3, and OpenAI.

## System design

<p align="center">
  <img src="System_architecture/architecture.png" alt="System Architecture" width="100%" />
</p>

The backend is four Lambda functions connected by S3 events and API
Gateway:

| Lambda      | Trigger                  | Job                                                          |
|-------------|--------------------------|--------------------------------------------------------------|
| LlamaGet    | POST `/llamaGet`         | Open a session, return an S3 presigned PUT URL               |
| LlamaParse  | S3 ObjectCreated         | Extract text, chunk, embed, persist to DynamoDB              |
| LlamaQuery  | POST `/query`            | Embed the question, rank chunks, call the LLM                |
| LlamaStatus | GET  `/sessions/{id}`    | Return the current parse status to the frontend              |

PDFs are uploaded directly from the browser to S3 via the presigned URL,
keeping Lambda out of the data path. Sessions move through
`AWAITING_UPLOAD → PROCESSING → READY_FOR_QUERY` (or `ERROR`), and the
frontend polls `LlamaStatus` to drive the UI rather than guessing how long
parsing will take.

Storage:
- **S3** — raw PDFs (`uploads/<sessionId>.pdf`)
- **DynamoDB sessions** — one row per session (status + metadata)
- **DynamoDB chunks** — one row per chunk (text + embedding vector)

## Getting started

### Frontend

```bash
cd frontend
npm install
npm start
```

Dev server at http://localhost:3000. API endpoint is configured in
`frontend/.env` as `REACT_APP_API_BASE`.

### Backend

Each Lambda lives in `Backend/` with its own `requirements.txt`. To
package one for deployment, install its deps into the function directory
and zip:

```bash
cd Backend/LlamaParse
pip install -r requirements.txt -t .
zip -r ../LlamaParse.zip .
```

See `Backend/README.md` for the full packaging instructions and DynamoDB
schema.

### Required AWS resources

- S3 bucket for PDF uploads
- DynamoDB sessions table: `sessionId` (string, PK)
- DynamoDB chunks table: `sessionId` (string, PK) + `chunkId` (string, SK)
- API Gateway with three routes:
  - `POST /llamaGet`         → LlamaGet
  - `POST /query`            → LlamaQuery
  - `GET  /sessions/{id}`    → LlamaStatus
- S3 event notification on the `uploads/` prefix → LlamaParse

### Environment variables

See `.env.example` for the full list. The headline ones:

| Function    | Variables                                                  |
|-------------|------------------------------------------------------------|
| LlamaGet    | `BUCKET_NAME`, `TABLE_NAME`                                |
| LlamaParse  | `BUCKET_NAME`, `SESSIONS_TABLE`, `CHUNKS_TABLE`, `OPENAI_API_KEY` |
| LlamaQuery  | `SESSIONS_TABLE`, `CHUNKS_TABLE`, `OPENAI_API_KEY`         |
| LlamaStatus | `SESSIONS_TABLE`                                           |

## Tests

```bash
# Backend
cd Backend
pip install -r tests/requirements.txt
pytest

# Frontend
cd frontend
npm test
```

Backend tests use `moto` to mock S3 + DynamoDB in-memory and patch the
OpenAI client per-test. Frontend tests use Jest + React Testing Library
with mocked `fetch`. Neither needs real AWS credentials or an OpenAI API
key to run.

## Usage

1. Start the frontend and open it in a browser.
2. Upload a PDF using the file input.
3. Wait for the status badge to switch from "Processing..." to "Ready"
   (the badge polls `LlamaStatus` every two seconds).
4. Click the file in the sidebar to view it.
5. Ask questions about the document in the chat panel.
