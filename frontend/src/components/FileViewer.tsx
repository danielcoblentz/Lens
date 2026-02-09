// renders the selected pdf using react-pdf

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface FileViewerProps {
  selectedFile: File | null;
}

function FileViewer({ selectedFile }: FileViewerProps) {
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [totalPageCount, setTotalPageCount] = useState<number | null>(null);

  // create/revoke object url when file changes
  useEffect(() => {
    if (!selectedFile) {
      setPdfObjectUrl(null);
      setTotalPageCount(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPdfObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  if (!selectedFile) {
    return (
      <div style={viewerStyles.emptyState}>
        No file selected - upload a PDF and click on it to view
      </div>
    );
  }

  return (
    <div style={viewerStyles.container}>
      <h2>Viewing: {selectedFile.name}</h2>
      <Document
        file={pdfObjectUrl}
        loading={<p>Loading PDF...</p>}
        onLoadSuccess={(doc) => setTotalPageCount(doc.numPages)}
        onLoadError={(err) => console.error('failed to load pdf:', err)}
      >
        {totalPageCount && renderAllPages(totalPageCount)}
      </Document>
    </div>
  );
}

function renderAllPages(pageCount: number) {
  return Array.from({ length: pageCount }, (_, i) => (
    <Page key={i + 1} pageNumber={i + 1} width={650} />
  ));
}

const viewerStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: '2rem',
    overflowY: 'auto',
    height: 'calc(100vh - 20px)',
  },
  emptyState: {
    padding: '2rem',
    color: '#777',
  },
};

export default FileViewer;
