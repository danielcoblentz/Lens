import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatBox from './ChatBox';
import * as awsService from '../services/aws';

jest.mock('../services/aws');

const queryRAG = awsService.queryRAG as jest.MockedFunction<typeof awsService.queryRAG>;

beforeEach(() => {
  queryRAG.mockReset();
});

describe('ChatBox', () => {
  it('disables the input when no session is selected', () => {
    render(<ChatBox sessionId={null} />);
    const input = screen.getByLabelText('chat input');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Select a document first');
  });

  it('sends the question and renders the assistant reply', async () => {
    queryRAG.mockResolvedValueOnce({
      sessionId: 's1',
      answer: 'The termination clause is in section 5.',
    });

    render(<ChatBox sessionId="s1" />);
    const input = screen.getByLabelText('chat input');
    fireEvent.change(input, { target: { value: 'termination clause?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('termination clause?')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText('The termination clause is in section 5.'),
      ).toBeInTheDocument(),
    );
    expect(queryRAG).toHaveBeenCalledWith('s1', 'termination clause?');
  });

  it('renders an error bubble when the API call fails', async () => {
    queryRAG.mockRejectedValueOnce(new Error('backend exploded'));

    render(<ChatBox sessionId="s1" />);
    fireEvent.change(screen.getByLabelText('chat input'), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText(/Error: backend exploded/i)).toBeInTheDocument(),
    );
  });

  it('ignores empty messages', () => {
    render(<ChatBox sessionId="s1" />);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(queryRAG).not.toHaveBeenCalled();
  });
});
