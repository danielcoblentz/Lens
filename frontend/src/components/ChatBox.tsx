// Chat panel for asking questions about the currently selected document.

import { useState } from 'react';
import { queryRAG } from '../services/aws';
import { Message } from '../types';

interface ChatBoxProps {
  sessionId: string | null;
}

function ChatBox({ sessionId }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!sessionId) {
      alert('Please select an uploaded document first.');
      return;
    }

    const question = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);

    try {
      const { answer } = await queryRAG(sessionId, question);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = isLoading || !sessionId;
  const placeholder = sessionId
    ? 'Ask a question about the document...'
    : 'Select a document first';

  return (
    <div style={styles.container}>
      <div style={styles.messages} data-testid="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#daf1ff' : '#eee',
            }}
            data-testid={`message-${msg.role}`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && handleSend()}
          disabled={disabled}
          aria-label="chat input"
        />
        <button
          style={{ ...styles.button, opacity: disabled ? 0.6 : 1 }}
          onClick={handleSend}
          disabled={disabled}
        >
          {isLoading ? '...' : 'Send'}
        </button>
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
    borderLeft: '1px solid #ddd',
  },
  messages: {
    flex: 1,
    padding: '1rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  bubble: {
    padding: '0.5rem 1rem',
    borderRadius: '12px',
    maxWidth: '80%',
  },
  inputRow: {
    display: 'flex',
    padding: '0.5rem',
    borderTop: '1px solid #ddd',
  },
  input: { flex: 1, padding: '0.5rem' },
  button: { marginLeft: '0.5rem', padding: '0.5rem 1rem' },
};

export default ChatBox;
