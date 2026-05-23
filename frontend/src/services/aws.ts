// Thin client for the Lens backend API.
//
// Three endpoints today:
//   POST /llamaGet         -> open a session, get an S3 presigned PUT URL
//   GET  /sessions/{id}    -> check parse status
//   POST /query            -> ask a question against an indexed session
//
// All requests are made against REACT_APP_API_BASE which is empty by default
// (so dev builds can be wired up to a CRA proxy in package.json if desired).

import {
  PresignResponse,
  QueryResponse,
  SessionStatusResponse,
} from '../types';

const API_BASE = process.env.REACT_APP_API_BASE || '';

export type UploadProgressCallback = (percentComplete: number) => void;

/** Ask LlamaGet for a fresh session and an S3 presigned URL to upload to. */
export async function requestPresignedUploadUrl(): Promise<PresignResponse> {
  const res = await fetch(`${API_BASE}/llamaGet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`failed to get presigned url: ${await res.text()}`);
  }

  const data = await res.json();
  return { sessionId: data.sessionId, uploadUrl: data.uploadUrl };
}

/**
 * PUT a file straight to S3 using the presigned URL.
 *
 * We use XMLHttpRequest instead of fetch so we get an upload progress
 * stream — fetch in browsers does not expose that today.
 */
export function uploadFileToS3(
  presignedUrl: string,
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () =>
      reject(new Error('upload failed - network error')),
    );

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.send(file);
  });
}

/**
 * Full upload flow.
 *
 * 1. Open a session and get a presigned URL.
 * 2. PUT the file to S3 — this is what triggers LlamaParse on the backend.
 * 3. Return the session id so the caller can poll for parse completion.
 */
export async function uploadPDF(
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<{ sessionId: string }> {
  const { sessionId, uploadUrl } = await requestPresignedUploadUrl();
  await uploadFileToS3(uploadUrl, file, onProgress);
  return { sessionId };
}

/** GET /sessions/{id} — returns AWAITING_UPLOAD / PROCESSING / READY_FOR_QUERY / ERROR. */
export async function fetchSessionStatus(
  sessionId: string,
): Promise<SessionStatusResponse> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) {
    throw new Error(`status check failed: ${await res.text()}`);
  }
  return res.json();
}

/** POST /query — RAG answer for a question against an indexed session. */
export async function queryRAG(
  sessionId: string,
  query: string,
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, query }),
  });

  if (!res.ok) {
    throw new Error(`query failed: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Poll fetchSessionStatus until the backend reports READY_FOR_QUERY or ERROR.
 *
 * Returns the final status. The caller decides what to do with it. Polling
 * stops early if `signal` is aborted (used to cancel polls when a component
 * unmounts).
 */
export async function pollSessionUntilReady(
  sessionId: string,
  options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<SessionStatusResponse> {
  const { intervalMs = 2000, timeoutMs = 120_000, signal } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error('poll cancelled');
    }
    const status = await fetchSessionStatus(sessionId);
    if (status.status === 'READY_FOR_QUERY' || status.status === 'ERROR') {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`timed out waiting for session ${sessionId} to be ready`);
}
