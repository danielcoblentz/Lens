// chat interface component for asking questions about uploaded documents

import { useState } from 'react';
import { queryRAG } from '../services/aws';
import { Message } from '../types';

interface ChatBoxProps {
  sessionId: string | null;  // session id of the currently selected document
}

function ChatBox({ sessionId }: ChatBoxProps) {
  // state for all messages in the conversation
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);

  // state for the text user is currently typing
  const [userInputText, setUserInputText] = useState('');

  // state to track if we're waiting for a response from the server
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);


  // called when user clicks send or presses enter
  const handleSendMessage = async () => {
    // don't send empty messages
    const messageIsEmpty = !userInputText.trim();
    if (messageIsEmpty) {
      return;
    }

    // make sure a document is selected first
    const noDocumentSelected = !sessionId;
    if (noDocumentSelected) {
      alert('Please select an uploaded document first before asking questions.');
      return;
    }

    // save the message text and clear the input
    const questionText = userInputText;
    setUserInputText('');

    // add user message to conversation
    const userMessage: Message = {
      role: 'user',
      content: questionText,
    };
    setConversationMessages((previousMessages) => [...previousMessages, userMessage]);

    // show loading state
    setIsWaitingForResponse(true);

    try {
      // send question to backend and get answer
      const ragResponse = await queryRAG(sessionId, questionText);
      const answerText = ragResponse.answer;

      // add assistant response to conversation
      const assistantMessage: Message = {
        role: 'assistant',
        content: answerText,
      };
      setConversationMessages((previousMessages) => [...previousMessages, assistantMessage]);

    } catch (queryError) {
      // handle errors by showing error message in chat
      console.error('query to backend failed:', queryError);

      const errorText = queryError instanceof Error
        ? queryError.message
        : 'unknown error occurred';

      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${errorText}`,
      };
      setConversationMessages((previousMessages) => [...previousMessages, errorMessage]);

    } finally {
      // hide loading state
      setIsWaitingForResponse(false);
    }
  };


  // called when user presses a key in the input field
  const handleKeyPress = (event: React.KeyboardEvent) => {
    const pressedEnter = event.key === 'Enter';
    const notCurrentlyLoading = !isWaitingForResponse;

    if (pressedEnter && notCurrentlyLoading) {
      handleSendMessage();
    }
  };


  // determine if input should be disabled
  const inputShouldBeDisabled = isWaitingForResponse || !sessionId;
  const placeholderText = sessionId
    ? 'Ask a question about the document...'
    : 'Select a document first';


  return (
    <div style={chatStyles.container}>

      {/* messages display area */}
      <div style={chatStyles.messagesArea}>
        {conversationMessages.map((message, messageIndex) => {
          const isUserMessage = message.role === 'user';
          const bubbleAlignment = isUserMessage ? 'flex-end' : 'flex-start';
          const bubbleColor = isUserMessage ? '#daf1ff' : '#eee';

          return (
            <div
              key={messageIndex}
              style={{
                ...chatStyles.messageBubble,
                alignSelf: bubbleAlignment,
                background: bubbleColor,
              }}
            >
              {message.content}
            </div>
          );
        })}
      </div>

      {/* input area */}
      <div style={chatStyles.inputArea}>
        <input
          style={chatStyles.textInput}
          value={userInputText}
          placeholder={placeholderText}
          onChange={(event) => setUserInputText(event.target.value)}
          onKeyDown={handleKeyPress}
          disabled={inputShouldBeDisabled}
        />
        <button
          style={{
            ...chatStyles.sendButton,
            opacity: inputShouldBeDisabled ? 0.6 : 1,
          }}
          onClick={handleSendMessage}
          disabled={inputShouldBeDisabled}
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
