# Lens

A serverless document analysis tool that lets users upload legal contracts and ask questions about them using retrieval-augmented generation. Built on AWS Lambda, DynamoDB, S3, and OpenAI.

## System Design

<p align="center">
  <img src="System_architecture/architecture.png" alt="System Architecture" width="100%" />
</p>

The system is split into three Lambda functions connected by S3 events and API Gateway:

**LlamaGet** handles session creation. When a user uploads a file, the frontend requests a presigned S3 URL and a new session ID. The PDF is uploaded directly from the browser to S3, keeping Lambda out of the data path.

**LlamaParse** is triggered automatically by the S3 upload event. It downloads the PDF, extracts text, splits it into overlapping chunks using recursive hierarchical separators, generates vector embeddings for each chunk via OpenAI, and stores everything in DynamoDB. Once done, it marks the session as ready for queries.

**LlamaQuery** handles the question-answering flow. It embeds the user's question, retrieves all stored chunks for that session, ranks them by cosine similarity, selects the most relevant ones, and sends them to the LLM with a legal analysis prompt. The response is returned along with latency metrics.

Storage is split between S3 for raw PDFs and DynamoDB for session metadata, text chunks, and embedding vectors. All external communication goes through API Gateway over HTTPS.

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm start
```

The dev server starts at [http://localhost:3000](http://localhost:3000). API endpoints are configured in `frontend/.env`.

### Backend

Each Lambda function lives in `backend/` and needs to be packaged with its dependencies before deploying to AWS:

```bash
# LlamaGet uses boto3 which is already available in Lambda

# LlamaParse
pip install PyPDF2 openai -t backend/LlamaParse

# LlamaQuery
pip install -r backend/LlamaQuery/requirements.txt -t backend/LlamaQuery
```

### Required AWS Resources

- An S3 bucket for PDF uploads
- Two DynamoDB tables: one for sessions (`sessionId` as partition key) and one for chunks (`sessionId` as partition key, `chunkId` as sort key)
- API Gateway with POST routes for `/llamaGet` and `/query`
- An S3 event notification on the `uploads/` prefix to trigger LlamaParse

### Environment Variables

Set these in the Lambda console for each function:

| Function | Variables |
|----------|-----------|
| LlamaGet | `BUCKET_NAME`, `TABLE_NAME` |
| LlamaParse | `BUCKET_NAME`, `SESSIONS_TABLE`, `CHUNKS_TABLE`, `OPENAI_API_KEY` |
| LlamaQuery | `SESSIONS_TABLE`, `CHUNKS_TABLE`, `OPENAI_API_KEY` |

## Usage

1. Start the frontend and open it in a browser
2. Upload a PDF using the file input
3. Wait for the status badge to show "Ready"
4. Click on the file in the sidebar to view it
5. Ask questions about the document in the chat panel
