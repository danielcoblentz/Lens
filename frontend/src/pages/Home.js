import React, { useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import FileViewer from "../components/FileViewer";
import ChatBox from "../components/ChatBox";


function Home() {
  const [filesMeta, setFilesMeta] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const filesRef = useRef([]); // File objects

  const handleUpload = (e) => {
    const selected = Array.from(e.target.files || []);

    // store File objects
    filesRef.current = [...filesRef.current, ...selected];

    // keep metadata for UI
    const metas = selected.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    }));

    setFilesMeta((prev) => [...prev, ...metas]);
  };

  const handleSelect = (fileMeta) => {
    // find the file object that matches the metadata
    const actualFile = filesRef.current.find(
      (f) =>
        f.name === fileMeta.name &&
        f.size === fileMeta.size &&
        f.lastModified === fileMeta.lastModified
    );

    setSelectedFile(actualFile || null);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      {/* LEFT: Sidebar */}
      <Sidebar files={filesMeta} onSelect={handleSelect} />

      {/* MIDDLE: Viewer + Upload area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "2rem" }}>
          <h1>Upload Files</h1>
          <input type="file" multiple onChange={handleUpload} />
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <FileViewer selectedFile={selectedFile} />
        </div>
      </div>

      <ChatBox />   

    </div>
  );
}

export default Home;
