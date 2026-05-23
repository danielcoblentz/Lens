// Home page: upload PDFs, view them, ask questions.
//
// State is intentionally local. Each uploaded file is tracked by name in a
// status map (uploading -> processing -> ready | error). The actual File
// objects live in a ref because they cannot be serialized into React state
// without losing the underlying blob.

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Sidebar from '../components/Sidebar';
import FileViewer from '../components/FileViewer';
import ChatBox from '../components/ChatBox';
import { uploadPDF, pollSessionUntilReady } from '../services/aws';
import { FileMeta, UploadStatus } from '../types';

function Home() {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({});

  const fileObjects = useRef<File[]>([]);
  const pollAbortControllers = useRef<AbortController[]>([]);

  // Cancel any in-flight polls when the page unmounts so we don't leak fetches.
  useEffect(() => {
    return () => pollAbortControllers.current.forEach((c) => c.abort());
  }, []);

  const updateFileStatus = (
    fileName: string,
    patch: Partial<UploadStatus>,
  ) => {
    setUploadStatus((prev) => ({
      ...prev,
      [fileName]: { ...prev[fileName], ...patch },
    }));
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);

    for (const file of selected) {
      if (file.type !== 'application/pdf') {
        alert(`${file.name} is not a PDF file. Only PDFs are supported.`);
        continue;
      }

      fileObjects.current = [...fileObjects.current, file];
      setFiles((prev) => [
        ...prev,
        {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },
      ]);

      setUploadStatus((prev) => ({
        ...prev,
        [file.name]: { progress: 0, status: 'uploading', sessionId: null },
      }));

      try {
        const { sessionId } = await uploadPDF(file, (progress) =>
          updateFileStatus(file.name, { progress }),
        );

        // Upload is done. LlamaParse is now chunking + embedding the PDF.
        updateFileStatus(file.name, {
          progress: 100,
          status: 'processing',
          sessionId,
        });

        // Poll the backend until parsing finishes. This replaces the old
        // setTimeout(10s) hack which guessed when parsing would finish.
        const controller = new AbortController();
        pollAbortControllers.current.push(controller);

        pollSessionUntilReady(sessionId, { signal: controller.signal })
          .then((status) => {
            if (status.status === 'READY_FOR_QUERY') {
              updateFileStatus(file.name, { status: 'ready' });
            } else {
              updateFileStatus(file.name, {
                status: 'error',
                error: status.error ?? 'parse failed',
              });
            }
          })
          .catch((err) => {
            if (err instanceof Error && err.message === 'poll cancelled') return;
            updateFileStatus(file.name, {
              status: 'error',
              error: err instanceof Error ? err.message : 'unknown error',
            });
          });
      } catch (err) {
        updateFileStatus(file.name, {
          progress: 0,
          status: 'error',
          sessionId: null,
          error: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }
  };

  const handleSelect = (meta: FileMeta) => {
    const file = fileObjects.current.find(
      (f) =>
        f.name === meta.name &&
        f.size === meta.size &&
        f.lastModified === meta.lastModified,
    );
    setSelectedFile(file || null);
    setActiveSessionId(uploadStatus[meta.name]?.sessionId ?? null);
  };

  return (
    <div style={styles.container}>
      <Sidebar
        files={files}
        onSelect={handleSelect}
        uploadStatus={uploadStatus}
      />
      <div style={styles.main}>
        <div style={styles.uploadArea}>
          <h1>Upload Files</h1>
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleUpload}
            aria-label="upload PDF"
          />
        </div>
        <div style={styles.viewer}>
          <FileViewer selectedFile={selectedFile} />
        </div>
      </div>
      <ChatBox sessionId={activeSessionId} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', height: '100vh' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  uploadArea: { padding: '2rem' },
  viewer: { flex: 1, overflow: 'auto' },
};

export default Home;
