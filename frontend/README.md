# Lens Frontend (Create React App)

React + react-pdf UI for uploading PDFs, viewing pages, and chatting against backend RAG endpoints.

## Scripts (CRA)
- `npm start` — dev server at http://localhost:3000
- `npm test` — CRA test runner
- `npm run build` — production build to `build/`

## Project structure (key)
- `src/pages/Home.js` — layout wiring sidebar, viewer, and chat.
- `src/components/Sidebar.js` — file list.
- `src/components/FileViewer.js` — PDF rendering via `react-pdf`.
- `src/components/ChatBox.js` — chat UI scaffold.

## Wiring to the backend
Add your API base and any defaults via environment variables (CRA uses `REACT_APP_*`):
- `REACT_APP_API_BASE` — API Gateway base URL (e.g., `https://xyz.execute-api.us-east-1.amazonaws.com/prod`).
- Optional: `REACT_APP_DEFAULT_TOP_K`, `REACT_APP_DEFAULT_SESSION_ID` for testing.

Update `Home.js` and `ChatBox.js` to call your deployed `presign` and `query` endpoints. Keep secrets out of the frontend; only non-sensitive URLs/flags should be in env files.

## Requirements
- Node 18+
- npm

## Notes
- This project uses Create React App (not Vite). Use `npm start`/`npm run build` from CRA scripts.
- Ensure `react-pdf` worker is reachable (see `FileViewer.js` for workerSrc config).
