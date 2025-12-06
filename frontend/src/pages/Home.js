import React, { useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import FileViewer from "../components/FileViewer";
import ChatBox from "../components/ChatBox";
import { uploadPDF } from "../services/aws";

function Home() {
  const [filesMeta, setFilesMeta] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({});               // { [fileName]: { progress, status, sessionId } }
  const filesRef = useRef([]); // file objects

  const handleUpload = async (e) => {
    const selected = Array.from(e.target.files || []);

    for (const file of selected) {
      // Only allow PDFs -- may update later for multiple formats
      if (file.type !== "application/pdf") {
        alert(`${file.name} is not a PDF file`);
        continue;
      }

      // store file object
      filesRef.current = [...filesRef.current, file];

      // Add metadata for UI
      const meta = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      };
      setFilesMeta((prev) => [...prev, meta]);

      // initial upload status
      setUploadStatus((prev) => ({
        ...prev,
        [file.name]: { progress: 0, status: "uploading", sessionId: null },
      }));

      try {
        // upload to S3 via presigned URL
        const { sessionId } = await uploadPDF(file, (progress) => {
          setUploadStatus((prev) => ({
            ...prev,
            [file.name]: { ...prev[file.name], progress },
          }));
        });

        // update status to processing (S3 triggers LlamaParse)
        setUploadStatus((prev) => ({
          ...prev,
          [file.name]: { progress: 100, status: "processing", sessionId },
        }));

        // assume processing is complete after 10 sec default (changing this later to be a response after the doc is done processing once recieved it will update UI)
        
        setTimeout(() => {
          setUploadStatus((prev) => ({
            ...prev,
            [file.name]: { ...prev[file.name], status: "ready" },}));}, 10000);

      } catch (error) {
        console.error("Upload failed:", error);
        setUploadStatus((prev) => ({
          ...prev,
          [file.name]: { progress: 0, status: "error", error: error.message },
        }));
      }
    }
  };

  const handleSelect = (fileMeta) => {
    // find the file object that matches the metadata
    const actualFile = filesRef.current.find(
      (f) =>
        f.name === fileMeta.name &&
        f.size === fileMeta.size &&
        f.lastModified === fileMeta.lastModified);

    setSelectedFile(actualFile || null);

    //  set active session ID for querying
    const status = uploadStatus[fileMeta.name];
    // always update sessionId (set to null if not available yet)
    setActiveSessionId(status?.sessionId || null);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>

      {/* LEFT: Sidebar */}
      <Sidebar files={filesMeta} onSelect={handleSelect} uploadStatus={uploadStatus} />

      {/* MIDDLE: Viewer + Upload area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "2rem" }}>
          <h1>Upload Files</h1>
          <input type="file" multiple accept=".pdf" onChange={handleUpload} />
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <FileViewer selectedFile={selectedFile} />
        </div>
      </div>

      <ChatBox sessionId={activeSessionId} />

    </div>
  );
}

export default Home;
