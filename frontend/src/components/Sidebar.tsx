// sidebar component - displays list of uploaded files with their status

import React from 'react';
import { FileMeta, UploadStatus } from '../types';

interface StatusBadgeProps {
  status: UploadStatus['status'];
  progress: number;
}

// shows the upload/processing status of a file
function StatusBadge({ status, progress }: StatusBadgeProps) {

  // get background color based on status
  const getBackgroundColor = (): React.CSSProperties => {
    if (status === 'uploading') {
      return { background: '#ffd700', color: '#000' };  // gold for uploading
    }
    if (status === 'processing') {
      return { background: '#87ceeb', color: '#000' };  // light blue for processing
    }
    if (status === 'ready') {
      return { background: '#90ee90', color: '#000' };  // light green for ready
    }
    if (status === 'error') {
      return { background: '#ff6b6b', color: '#fff' };  // red for error
    }
    return { background: '#ddd', color: '#000' };  // gray for unknown
  };

  // get display text based on status
  const getDisplayText = (): string => {
    if (status === 'uploading') {
      return `${progress}%`;
    }
    if (status === 'processing') {
      return 'Processing...';
    }
    if (status === 'ready') {
      return 'Ready';
    }
    if (status === 'error') {
      return 'Error';
    }
    return '';
  };

  return (
    <span style={{ ...sidebarStyles.badge, ...getBackgroundColor() }}>
      {getDisplayText()}
    </span>
  );
}


interface SidebarProps {
  files: FileMeta[];                              // list of file metadata to display
  onSelect: (file: FileMeta) => void;             // callback when user clicks a file
  uploadStatus: Record<string, UploadStatus>;     // upload status for each file by name
}

// main sidebar component
function Sidebar({ files, onSelect, uploadStatus = {} }: SidebarProps) {
  return (
    <div style={sidebarStyles.container}>

      {/* app title */}
      <h2 style={sidebarStyles.appTitle}>Lens</h2>

      {/* section header */}
      <h3 style={sidebarStyles.sectionHeader}>Files</h3>

      {/* scrollable list of files */}
      <div style={sidebarStyles.fileList}>
        {files.map((fileMetadata, fileIndex) => {
          const statusForThisFile = uploadStatus[fileMetadata.name];

          return (
            <div
              key={fileIndex}
              style={sidebarStyles.fileItem}
              onClick={() => onSelect(fileMetadata)}
            >
              {/* file name */}
              <div style={sidebarStyles.fileName}>
                {fileMetadata.name}
              </div>

              {/* status badge if available */}
              {statusForThisFile && (
                <StatusBadge
                  status={statusForThisFile.status}
                  progress={statusForThisFile.progress}
                />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

const sidebarStyles: Record<string, React.CSSProperties> = {
  container: {
    width: '250px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f4f4f4',
    padding: '1rem',
    borderRight: '1px solid #ddd',
    boxSizing: 'border-box',
  },
  appTitle: {
    margin: 0,
    marginBottom: '0.5rem',
  },
  sectionHeader: {
    margin: 0,
    marginBottom: '0.75rem',
    fontSize: '1rem',
  },
  fileList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    paddingRight: '0.25rem',
  },
  fileItem: {
    padding: '0.5rem',
    background: '#fff',
    borderRadius: '4px',
    border: '1px solid #ccc',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  },
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  badge: {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
};

export default Sidebar;
