// all api calls to our aws lambda endpoints

import { PresignResponse, QueryResponse } from '../types';

const awsApiGatewayBaseUrl = process.env.REACT_APP_API_BASE || '';

type UploadProgressCallback = (percentComplete: number) => void;


// get a presigned url from llamaGet - creates a session and gives us a url to upload to
async function requestPresignedUploadUrl(): Promise<PresignResponse> {
  const res = await fetch(`${awsApiGatewayBaseUrl}/llamaGet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`failed to get presigned url: ${msg}`);
  }

  const data = await res.json();
  return { sessionId: data.sessionId, uploadUrl: data.uploadUrl };
}


// upload pdf directly to s3 via presigned url
// using XMLHttpRequest instead of fetch so we can track upload progress
function uploadPdfFileToS3(
  presignedUrl: string,
  file: File,
  onProgress?: UploadProgressCallback
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

    xhr.addEventListener('error', () => reject(new Error('upload failed - network error')));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.send(file);
  });
}


// main upload flow: get presigned url then upload to s3
// after upload, s3 triggers llamaParse to chunk + embed the pdf
export async function uploadPDF(
  pdfFile: File,
  onProgress?: UploadProgressCallback
): Promise<{ sessionId: string }> {
  const { sessionId, uploadUrl } = await requestPresignedUploadUrl();
  await uploadPdfFileToS3(uploadUrl, pdfFile, onProgress);
  return { sessionId };
}


// send a question to llamaQuery and get a rag answer back
export async function queryRAG(sessionId: string, question: string): Promise<QueryResponse> {
  const res = await fetch(`${awsApiGatewayBaseUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, query: question }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`query failed: ${msg}`);
  }

  return res.json();
}
