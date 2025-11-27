import React, { useState, useRef } from "react";
import Sidebar from "./components/Sidebar";

function Home() {
  // store only metadata in state (keeps serializable/lightweight)
  const [filesMeta, setFilesMeta] = useState([]);
  // store actual File objects in a ref (not serialized)
  const filesRef = useRef([]);

  const handleUpload = (e) => {
    const selected = Array.from(e.target.files || []);
    // push actual File objects into the ref
    filesRef.current = [...filesRef.current, ...selected];

    // create metadata list for UI only
    const metas = selected.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    }));

    setFilesMeta((prev) => [...prev, ...metas]);
  };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar files={filesMeta} />

      <div style={{ padding: "2rem", flex: 1 }}>
        <h1>Upload Files</h1>

        <input 
          type="file" 
          multiple 
          onChange={handleUpload}
        />

        <p style={{ marginTop: "1rem" }}>
          Uploaded files will appear in the sidebar. Note: file contents are kept only in memory and are not written to disk by the app.
        </p>
      </div>
    </div>
  );
}

export default Home;
