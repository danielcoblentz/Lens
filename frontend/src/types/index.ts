// Shared types used across the Lens frontend.

/** Lightweight, serializable representation of a File we keep in React state. */
export interface FileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

/** Status of a file as it moves through upload -> parse -> ready. */
export type UploadPhase = 'uploading' | 'processing' | 'ready' | 'error';

export interface UploadStatus {
  progress: number;
  status: UploadPhase;
  sessionId: string | null;
  error?: string;
}

/** A single turn in the chat conversation. */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Response from POST /llamaGet — opens a session and returns an S3 PUT URL. */
export interface PresignResponse {
  sessionId: string;
  uploadUrl: string;
}

/** Response from POST /query. */
export interface QueryResponse {
  sessionId: string;
  answer: string;
  metrics?: Record<string, number>;
}

/** Backend status values mirrored from DynamoDB. */
export type BackendSessionStatus =
  | 'AWAITING_UPLOAD'
  | 'PROCESSING'
  | 'READY_FOR_QUERY'
  | 'ERROR';

/** Response from GET /sessions/{sessionId} — used to poll parse progress. */
export interface SessionStatusResponse {
  sessionId: string;
  status: BackendSessionStatus;
  error?: string;
}
