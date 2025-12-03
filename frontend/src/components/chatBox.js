import { useState } from "react";

function ChatBox () {
    const [messages, setMesssages] = useState([]);
    const [input, setInput] = useState("");

    const handleSend = () => {
        if (!input.trim()) return;

        setMesssages(prev => [...prev, {role: "user", content: input}]);
        setInput("")

        setMesssages(prev => [...prev, {role: "assistant", content: "Assistant response placeholder."}]);

    };

    return (
    <div style={styles.container}>
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#daf1ff" : "#eee",
            }}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          placeholder="Ask a question..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button style={styles.button} onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "250px",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid #ddd",
  },
  messages: {
    flex: 1,
    padding: "1rem",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  message: {
    padding: "0.5rem 1rem",
    borderRadius: "12px",
    maxWidth: "80%",
  },
  inputRow: {
    display: "flex",
    padding: "0.5rem",
    borderTop: "1px solid #ddd",
  },
  input: {
    flex: 1,
    padding: "0.5rem",
  },
  button: {
    marginLeft: "0.5rem",
    padding: "0.5rem 1rem",
  },
};

export default ChatBox;
