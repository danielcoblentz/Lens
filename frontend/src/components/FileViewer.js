import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();

function FileViewer({ selectedFile }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);

  useEffect(() => {
    if (!selectedFile) {
      setFileUrl(null);
      setNumPages(null);
      return;}

    const url = URL.createObjectURL(selectedFile);
    setFileUrl(url);

    return () => URL.revokeObjectURL(url);}, [selectedFile]);

  if (!selectedFile) {
    return <div style={styles.empty}>No file selected</div>;}

  return (
    <div style={styles.viewer}>
      <h2>Viewing: {selectedFile.name}</h2>

      <Document
        file={fileUrl}
        loading={<p>Loading PDF…</p>}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(e) => console.error("Error loading PDF:", e)}
      >
        {/* render pages only when PDF is fully loaded */}
        {numPages &&
          [...Array(numPages).keys()].map((i) => (
            <Page
              key={i}
              pageNumber={i + 1}
              width={800}
            />
          ))}
      </Document>
    </div>
  );
}

//style to pdf layout
const styles = {
  viewer: {
    padding: "2rem",
    overflowY: "auto",
    height: "calc(100vh - 20px)",
  },
  empty: {
    padding: "2rem",
    color: "#777",
  },
};

export default FileViewer;
