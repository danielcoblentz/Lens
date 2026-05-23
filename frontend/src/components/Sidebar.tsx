// Sidebar: list of uploaded files with their current upload/parse status.

import React from 'react';
import { FileMeta, UploadPhase, UploadStatus } from '../types';

interface StatusBadgeProps {
  status: UploadPhase;
  progress: number;
}

const BADGE_STYLES: Record<UploadPhase, React.CSSProperties> = {
  uploading: { background: '#ffd700', color: '#000' },
  processing: { background: '#87ceeb', color: '#000' },
  ready: { background: '#90ee90', color: '#000' },
  error: { background: '#ff6b6b', color: '#fff' },
};

const BADGE_LABEL: Record<UploadPhase, (progress: number) => string> = {
  uploading: (p) => `${p}%`,
  processing: () => 'Processing...',
  ready: () => 'Ready',
  error: () => 'Error',
};

export function StatusBadge({ status, progress }: StatusBadgeProps) {
  return (
    <span
      style={{ ...styles.badge, ...BADGE_STYLES[status] }}
      data-testid={`status-badge-${status}`}
    >
      {BADGE_LABEL[status](progress)}
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
    <div style={styles.container}>
      <h2 style={styles.title}>Lens</h2>
      <h3 style={styles.header}>Files</h3>

      <div style={styles.list}>
        {files.length === 0 && (
          <div style={styles.emptyHint}>No files uploaded yet.</div>
        )}
        {files.map((file) => {
          const status = uploadStatus[file.name];
          return (
            <button
              key={`${file.name}-${file.lastModified}`}
              type="button"
              style={styles.item}
              onClick={() => onSelect(file)}
              aria-label={`open ${file.name}`}
            >
              <span style={styles.fileName}>{file.name}</span>
              {status && (
                <StatusBadge status={status.status} progress={status.progress} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  title: { margin: 0, marginBottom: '0.5rem' },
  header: { margin: 0, marginBottom: '0.75rem', fontSize: '1rem' },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    paddingRight: '0.25rem',
  },
  emptyHint: { color: '#888', fontSize: '0.875rem' },
  item: {
    padding: '0.5rem',
    background: '#fff',
    borderRadius: '4px',
    border: '1px solid #ccc',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    textAlign: 'left',
    font: 'inherit',
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
