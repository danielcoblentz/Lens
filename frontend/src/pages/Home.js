import React, { useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import FileViewer from "../components/FileViewer";


function Home() {
  const [filesMeta, setFilesMeta] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const filesRef = useRef([]); // actual File objects

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
    <div style={{ display: "flex" }}>
      <Sidebar files={filesMeta} onSelect={handleSelect} />

      <div style={{ padding: "2rem", flex: 1 }}>
        <h1>Upload Files</h1>

        <input 
          type="file" 
          multiple 
          accept="application/pdf"
          onChange={handleUpload}/>

        <p style={{ marginTop: "1rem" }}>
          Uploaded files will appear in the sidebar.
        </p>

        <FileViewer selectedFile={selectedFile} />
      </div>
    </div>
  );
}

export default Home;
