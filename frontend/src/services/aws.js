/**
 * AWS API service for communicating with Lambda endpoints
 */

const API_BASE = process.env.REACT_APP_API_BASE || '';

/**
 * Get a presigned URL for uploading a PDF to S3
 * Also creates a session in DynamoDB with AWAITING_UPLOAD status
 * @returns {Promise<{sessionId: string, uploadUrl: string}>}
 */
export async function getPresignedUploadUrl() {
  const response = await fetch(`${API_BASE}/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get presigned URL: ${error}`);
  }

  const data = await response.json();
  return {
    sessionId: data.sessionId,
    uploadUrl: data.uploadUrl,
  };
}

/**
 * Upload a file directly to S3 using a presigned URL
 * @param {string} presignedUrl - The presigned URL from getPresignedUploadUrl
 * @param {File} file - The PDF file to upload
 * @param {function} onProgress - Optional callback for upload progress (0-100)
 * @returns {Promise<void>}
 */
export async function uploadFileToS3(presignedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed due to network error'));
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.send(file);
  });
}

/**
 * Upload a PDF file to AWS
 * 1. Gets presigned URL from Lambda (creates session)
 * 2. Uploads file directly to S3
 * 3. S3 upload triggers LlamaParse Lambda automatically
 *
 * @param {File} file - The PDF file to upload
 * @param {function} onProgress - Optional callback for upload progress (0-100)
 * @returns {Promise<{sessionId: string}>} - The session ID for querying later
 */
export async function uploadPDF(file, onProgress) {
  // Step 1: Get presigned URL from LlamaGet Lambda
  const { sessionId, uploadUrl } = await getPresignedUploadUrl();

  // Step 2: Upload directly to S3 (this triggers LlamaParse automatically)
  await uploadFileToS3(uploadUrl, file, onProgress);

  return { sessionId };
}

/**
 * Query the RAG pipeline with a question
 * @param {string} sessionId - The session ID from uploadPDF
 * @param {string} query - The user's question
 * @returns {Promise<{sessionId: string, answer: string}>}
 */
export async function queryRAG(sessionId, query) {
  const response = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      query,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Query failed: ${error}`);
  }

  return response.json();
}
