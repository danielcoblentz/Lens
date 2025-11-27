import React from "react";

// holds files the user will upload and later review the contents
function Sidebar({ files, onSelect }) {
  return (
    <div style={styles.sidebar}>
      <h2 style={styles.title}>AWS Lambda</h2>
      <h3 style={styles.header}>Files</h3>

      {/* scrollable section if we have many files uploaded */}
      <div style={styles.list}>
        {files.map((file, idx) => (
          <div 
            key={idx} 
            style={styles.item}
            onClick={() => onSelect(file)}
          >
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
    display: "flex",
    flexDirection: "column",
    background: "#f4f4f4",
    padding: "1rem",
    borderRight: "1px solid #ddd",
    boxSizing: "border-box"
  },
  title: {
    margin: 0,
    marginBottom: "0.5rem",
  },
  header: {
    margin: 0,
    marginBottom: "0.75rem",
    fontSize: "1rem"
  },
  list: {
    flex: 1,                
    overflowY: "auto",       
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    paddingRight: "0.25rem"
  },
  item: {
    padding: "0.5rem",
    background: "#fff",
    borderRadius: "4px",
    border: "1px solid #ccc",
    cursor: "pointer"    
  }
};

export default Sidebar;
