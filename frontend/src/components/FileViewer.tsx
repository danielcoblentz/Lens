// pdf viewer component - displays the currently selected pdf file

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// configure pdf.js worker (required for react-pdf to work)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface FileViewerProps {
  selectedFile: File | null;  // the pdf file to display, or null if none selected
}

function FileViewer({ selectedFile }: FileViewerProps) {
  // state for the object url we create from the file (needed for react-pdf)
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

  // state for total number of pages in the pdf
  const [totalPageCount, setTotalPageCount] = useState<number | null>(null);


  // create object url when file changes, and clean up old url
  useEffect(() => {
    // if no file selected, clear the url and page count
    if (!selectedFile) {
      setPdfObjectUrl(null);
      setTotalPageCount(null);
      return;
    }

    // create a url for the file so react-pdf can load it
    const newObjectUrl = URL.createObjectURL(selectedFile);
    setPdfObjectUrl(newObjectUrl);

    // cleanup function - revoke the url when component unmounts or file changes
    return () => {
      URL.revokeObjectURL(newObjectUrl);
    };
  }, [selectedFile]);


  // show placeholder if no file is selected
  if (!selectedFile) {
    return (
      <div style={viewerStyles.emptyState}>
        No file selected - upload a PDF and click on it to view
      </div>
    );
  }


  // called when pdf successfully loads
  const handlePdfLoadSuccess = (pdfDocument: { numPages: number }) => {
    const numberOfPages = pdfDocument.numPages;
    setTotalPageCount(numberOfPages);
  };

  // called if pdf fails to load
  const handlePdfLoadError = (error: Error) => {
    console.error('failed to load pdf:', error);
  };


  return (
    <div style={viewerStyles.container}>

      {/* file name header */}
      <h2>Viewing: {selectedFile.name}</h2>

      {/* pdf document viewer */}
      <Document
        file={pdfObjectUrl}
        loading={<p>Loading PDF...</p>}
        onLoadSuccess={handlePdfLoadSuccess}
        onLoadError={handlePdfLoadError}
      >
        {/* render each page once we know the total page count */}
        {totalPageCount && renderAllPages(totalPageCount)}
      </Document>

    </div>
  );
}


// helper function to render all pages of the pdf
function renderAllPages(pageCount: number) {
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

  return pageNumbers.map((pageNumber) => (
    <Page
      key={pageNumber}
      pageNumber={pageNumber}
      width={650}
    />
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
