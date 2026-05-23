// PDF viewer powered by react-pdf.
//
// We create a blob URL from the local File object so the user can scroll
// through the document without re-uploading it from S3.

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface FileViewerProps {
  selectedFile: File | null;
}

function FileViewer({ selectedFile }: FileViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setObjectUrl(null);
      setPageCount(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  if (!selectedFile) {
    return (
      <div style={styles.empty}>
        No file selected — upload a PDF and click on it in the sidebar to view.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>Viewing: {selectedFile.name}</h2>
      <Document
        file={objectUrl}
        loading={<p>Loading PDF...</p>}
        onLoadSuccess={(doc) => setPageCount(doc.numPages)}
        onLoadError={(err) => console.error('failed to load pdf:', err)}
      >
        {pageCount !== null &&
          Array.from({ length: pageCount }, (_, i) => (
            <Page key={i + 1} pageNumber={i + 1} width={650} />
          ))}
      </Document>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '2rem',
    overflowY: 'auto',
    height: 'calc(100vh - 20px)',
  },
  empty: {
    padding: '2rem',
    color: '#777',
  },
};

export default FileViewer;
