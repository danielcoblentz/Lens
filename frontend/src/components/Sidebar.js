import React from "react";

// holds files the user will upload and later review the contents
function Sidebar({ files }) {
  return (
    <div style={styles.sidebar}>
        <h2>AWS Lambda</h2>
      <h2 style={styles.header}>Files</h2>

      <div style={styles.list}>
        {files.length === 0 && <p>No files uploaded yet.</p>}
        {files.map((file, idx) => (
          <div key={idx} style={styles.item}>
            {file.name}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: "250px",
    height: "100vh",
    overflowY: "auto",
    background: "#f4f4f4",
    padding: "1rem",
    borderRight: "1px solid #ddd",
    boxSizing: "border-box"
  },
  header: {
    marginBottom: "1rem",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  item: {
    padding: "0.5rem",
    background: "#fff",
    borderRadius: "4px",
    border: "1px solid #ccc",
  }
};

export default Sidebar;
