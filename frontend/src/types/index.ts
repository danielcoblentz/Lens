// shared types for the app

export interface FileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface UploadStatus {
  progress: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  sessionId: string | null;
  error?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface PresignResponse {
  sessionId: string;
  uploadUrl: string;
}

export interface QueryResponse {
  sessionId: string;
  answer: string;
}
