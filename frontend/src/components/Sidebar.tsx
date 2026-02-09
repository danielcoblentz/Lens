// sidebar - file list with upload status badges

import React from 'react';
import { FileMeta, UploadStatus } from '../types';

interface StatusBadgeProps {
  status: UploadStatus['status'];
  progress: number;
}

function StatusBadge({ status, progress }: StatusBadgeProps) {
  const colorMap: Record<string, React.CSSProperties> = {
    uploading:  { background: '#ffd700', color: '#000' },
    processing: { background: '#87ceeb', color: '#000' },
    ready:      { background: '#90ee90', color: '#000' },
    error:      { background: '#ff6b6b', color: '#fff' },
  };

  const textMap: Record<string, string> = {
    uploading:  `${progress}%`,
    processing: 'Processing...',
    ready:      'Ready',
    error:      'Error',
  };

  return (
    <span style={{ ...sidebarStyles.badge, ...(colorMap[status] || { background: '#ddd', color: '#000' }) }}>
      {textMap[status] || ''}
    </span>
  );
}


interface SidebarProps {
  files: FileMeta[];
  onSelect: (file: FileMeta) => void;
  uploadStatus: Record<string, UploadStatus>;
}

function Sidebar({ files, onSelect, uploadStatus = {} }: SidebarProps) {
  return (
    <div style={sidebarStyles.container}>
      <h2 style={sidebarStyles.appTitle}>Lens</h2>
      <h3 style={sidebarStyles.sectionHeader}>Files</h3>

      <div style={sidebarStyles.fileList}>
        {files.map((file, i) => {
          const status = uploadStatus[file.name];
          return (
            <div key={i} style={sidebarStyles.fileItem} onClick={() => onSelect(file)}>
              <div style={sidebarStyles.fileName}>{file.name}</div>
              {status && <StatusBadge status={status.status} progress={status.progress} />}
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
