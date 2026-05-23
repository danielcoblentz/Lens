import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar, { StatusBadge } from './Sidebar';
import { FileMeta, UploadStatus } from '../types';

const makeMeta = (name: string): FileMeta => ({
  name,
  size: 1024,
  type: 'application/pdf',
  lastModified: 1700000000000,
});

describe('StatusBadge', () => {
  it('shows progress percentage while uploading', () => {
    render(<StatusBadge status="uploading" progress={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('shows the friendly label for non-uploading states', () => {
    const { rerender } = render(
      <StatusBadge status="processing" progress={0} />,
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();

    rerender(<StatusBadge status="ready" progress={0} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();

    rerender(<StatusBadge status="error" progress={0} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  it('renders an empty-state hint when there are no files', () => {
    render(<Sidebar files={[]} onSelect={() => {}} uploadStatus={{}} />);
    expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument();
  });

  it('renders one row per file', () => {
    const files = [makeMeta('a.pdf'), makeMeta('b.pdf')];
    render(<Sidebar files={files} onSelect={() => {}} uploadStatus={{}} />);
    expect(screen.getByRole('button', { name: /open a.pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open b.pdf/i })).toBeInTheDocument();
  });

  it('renders the matching status badge for each file', () => {
    const status: Record<string, UploadStatus> = {
      'a.pdf': { progress: 50, status: 'uploading', sessionId: null },
      'b.pdf': { progress: 100, status: 'ready', sessionId: 's1' },
    };
    render(
      <Sidebar
        files={[makeMeta('a.pdf'), makeMeta('b.pdf')]}
        onSelect={() => {}}
        uploadStatus={status}
      />,
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('calls onSelect when a file is clicked', () => {
    const onSelect = jest.fn();
    render(<Sidebar files={[makeMeta('a.pdf')]} onSelect={onSelect} uploadStatus={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /open a.pdf/i }));
    expect(onSelect).toHaveBeenCalledWith(makeMeta('a.pdf'));
  });
});
