# Lens Frontend

React + TypeScript UI for the Lens document analysis tool. Uploads PDFs,
displays them with `react-pdf`, and chats against the RAG backend.

## Scripts

| Command           | What it does                              |
|-------------------|-------------------------------------------|
| `npm start`       | Dev server at http://localhost:3000       |
| `npm test`        | Run the test suite once (CI mode)         |
| `npm run test:watch` | Watch-mode test runner                 |
| `npm run build`   | Production build to `build/`              |

## Configuration

Set the API base URL in `.env`:

```
REACT_APP_API_BASE=https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

Only non-sensitive values belong in the client bundle.

## Project structure

```
src/
├── App.tsx                 — Router shell
├── index.tsx               — React entrypoint
├── pages/
│   └── Home.tsx            — Upload + viewer + chat layout
├── components/
│   ├── Sidebar.tsx         — File list with status badges
│   ├── FileViewer.tsx      — react-pdf viewer for the selected file
│   └── ChatBox.tsx         — RAG chat panel
├── services/
│   └── aws.ts              — fetch wrappers for the four backend endpoints
└── types/
    └── index.ts            — Shared TypeScript types
```

## Upload + parse flow

```
1. user picks a PDF
2. POST /llamaGet                        → sessionId + presigned URL
3. PUT pdf direct to S3                  (triggers LlamaParse on the backend)
4. status = uploading       (XHR progress)
5. status = processing      (after upload completes)
6. GET /sessions/{id} every 2s           (pollSessionUntilReady)
7. status = ready | error   (from the backend's session row)
```

The old `setTimeout(10s)` hack has been replaced by real polling against
the `LlamaStatus` Lambda.

## Testing

The suite uses Jest (via Create React App) + React Testing Library.
`fetch` is mocked per-test in `services/aws.test.ts`, and the AWS service
module is mocked when testing components that depend on it.
