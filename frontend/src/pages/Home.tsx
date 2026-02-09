// home page - upload pdfs, view them, ask questions

import React, { useState, useRef, ChangeEvent } from 'react';
import Sidebar from '../components/Sidebar';
import FileViewer from '../components/FileViewer';
import ChatBox from '../components/ChatBox';
import { uploadPDF } from '../services/aws';
import { FileMeta, UploadStatus } from '../types';

function Home() {
  const [allFilesMetadata, setAllFilesMetadata] = useState<FileMeta[]>([]);
  const [currentlySelectedFile, setCurrentlySelectedFile] = useState<File | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [fileUploadStatuses, setFileUploadStatuses] = useState<Record<string, UploadStatus>>({});

  // we need a ref for file objects since you cant serialize File into state metadata
  const actualFileObjectsRef = useRef<File[]>([]);


  const handleUserSelectedFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const filesUserSelected = Array.from(event.target.files || []);

    for (const selectedFile of filesUserSelected) {
      if (selectedFile.type !== 'application/pdf') {
        alert(`${selectedFile.name} is not a PDF file. Only PDF files are supported.`);
        continue;
      }

      actualFileObjectsRef.current = [...actualFileObjectsRef.current, selectedFile];

      const fileMetadata: FileMeta = {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        lastModified: selectedFile.lastModified,
      };
      setAllFilesMetadata((prev) => [...prev, fileMetadata]);

      setFileUploadStatuses((prev) => ({
        ...prev,
        [selectedFile.name]: { progress: 0, status: 'uploading', sessionId: null },
      }));

      try {
        const uploadResult = await uploadPDF(selectedFile, (pct) => {
          setFileUploadStatuses((prev) => ({
            ...prev,
            [selectedFile.name]: { ...prev[selectedFile.name], progress: pct },
          }));
        });

        const newSessionId = uploadResult.sessionId;

        // upload done, now llamaParse is chunking + embedding on the backend
        setFileUploadStatuses((prev) => ({
          ...prev,
          [selectedFile.name]: { progress: 100, status: 'processing', sessionId: newSessionId },
        }));

        // todo: poll backend for actual status instead of guessing 10s
        setTimeout(() => {
          setFileUploadStatuses((prev) => ({
            ...prev,
            [selectedFile.name]: { ...prev[selectedFile.name], status: 'ready' },
          }));
        }, 10000);

      } catch (uploadError) {
        console.error('file upload failed:', uploadError);
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'unknown error';
        setFileUploadStatuses((prev) => ({
          ...prev,
          [selectedFile.name]: { progress: 0, status: 'error', sessionId: null, error: errorMessage },
        }));
      }
    }
  };


  const handleUserClickedFile = (clickedFile: FileMeta) => {
    // match the metadata back to the actual File object for the viewer
    const matchingFile = actualFileObjectsRef.current.find((f) =>
      f.name === clickedFile.name && f.size === clickedFile.size && f.lastModified === clickedFile.lastModified
    );

    setCurrentlySelectedFile(matchingFile || null);
    setCurrentSessionId(fileUploadStatuses[clickedFile.name]?.sessionId || null);
  };


  return (
    <div style={pageLayoutStyles.container}>
      <Sidebar
        files={allFilesMetadata}
        onSelect={handleUserClickedFile}
        uploadStatus={fileUploadStatuses}
      />

      <div style={pageLayoutStyles.middleSection}>
        <div style={pageLayoutStyles.uploadArea}>
          <h1>Upload Files</h1>
          <input type="file" multiple accept=".pdf" onChange={handleUserSelectedFiles} />
        </div>
        <div style={pageLayoutStyles.viewerArea}>
          <FileViewer selectedFile={currentlySelectedFile} />
        </div>
      </div>

      <ChatBox sessionId={currentSessionId} />
    </div>
  );
}

const pageLayoutStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
  },
  middleSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  uploadArea: {
    padding: '2rem',
  },
  viewerArea: {
    flex: 1,
    overflow: 'auto',
  },
};

export default Home;
