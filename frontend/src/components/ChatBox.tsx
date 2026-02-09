// chat panel for asking questions about the selected document

import { useState } from 'react';
import { queryRAG } from '../services/aws';
import { Message } from '../types';

interface ChatBoxProps {
  sessionId: string | null;
}

function ChatBox({ sessionId }: ChatBoxProps) {
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [userInputText, setUserInputText] = useState('');
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);


  const handleSendMessage = async () => {
    if (!userInputText.trim()) return;

    if (!sessionId) {
      alert('Please select an uploaded document first before asking questions.');
      return;
    }

    const questionText = userInputText;
    setUserInputText('');

    setConversationMessages((prev) => [...prev, { role: 'user', content: questionText }]);
    setIsWaitingForResponse(true);

    try {
      const ragResponse = await queryRAG(sessionId, questionText);
      setConversationMessages((prev) => [...prev, { role: 'assistant', content: ragResponse.answer }]);
    } catch (err) {
      console.error('query failed:', err);
      const errorText = err instanceof Error ? err.message : 'unknown error';
      setConversationMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errorText}` }]);
    } finally {
      setIsWaitingForResponse(false);
    }
  };


  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isWaitingForResponse) {
      handleSendMessage();
    }
  };

  const inputDisabled = isWaitingForResponse || !sessionId;
  const placeholderText = sessionId ? 'Ask a question about the document...' : 'Select a document first';

  return (
    <div style={chatStyles.container}>
      <div style={chatStyles.messagesArea}>
        {conversationMessages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={i}
              style={{
                ...chatStyles.messageBubble,
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                background: isUser ? '#daf1ff' : '#eee',
              }}
            >
              {msg.content}
            </div>
          );
        })}
      </div>

      <div style={chatStyles.inputArea}>
        <input
          style={chatStyles.textInput}
          value={userInputText}
          placeholder={placeholderText}
          onChange={(e) => setUserInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={inputDisabled}
        />
        <button
          style={{ ...chatStyles.sendButton, opacity: inputDisabled ? 0.6 : 1 }}
          onClick={handleSendMessage}
          disabled={inputDisabled}
        >
          {isWaitingForResponse ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

const chatStyles: Record<string, React.CSSProperties> = {
  container: {
    width: '250px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid #ddd',
  },
  messagesArea: {
    flex: 1,
    padding: '1rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  messageBubble: {
    padding: '0.5rem 1rem',
    borderRadius: '12px',
    maxWidth: '80%',
  },
  inputArea: {
    display: 'flex',
    padding: '0.5rem',
    borderTop: '1px solid #ddd',
  },
  textInput: {
    flex: 1,
    padding: '0.5rem',
  },
  sendButton: {
    marginLeft: '0.5rem',
    padding: '0.5rem 1rem',
  },
};

export default ChatBox;
