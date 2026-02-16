import { useState, useEffect } from "react";

interface LobbyProps {
  onJoinRoom: (roomId: string, playerName: string, apiKey: string) => void;
}

export function Lobby({ onJoinRoom }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Check URL for room invite
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setRoomIdInput(room);
  }, []);

  const createRoom = async () => {
    if (!playerName.trim() || !apiKey.trim()) {
      setError("Name and API key are required");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const { roomId } = await res.json();
      onJoinRoom(roomId, playerName.trim(), apiKey.trim());
    } catch {
      setError("Failed to create room");
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = () => {
    if (!playerName.trim() || !apiKey.trim()) {
      setError("Name and API key are required");
      return;
    }
    if (!roomIdInput.trim()) {
      setError("Room code is required");
      return;
    }
    onJoinRoom(roomIdInput.trim(), playerName.trim(), apiKey.trim());
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Splat World</h1>
        <p style={styles.subtitle}>
          Generate 3D worlds from images and explore them with friends
        </p>

        <div style={styles.section}>
          <label style={styles.label}>Your Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
          />
        </div>

        <div style={styles.section}>
          <label style={styles.label}>
            World Labs API Key
            <a
              href="https://platform.worldlabs.ai/"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              Get one here
            </a>
          </label>
          <input
            style={styles.input}
            type="password"
            placeholder="WLT-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div style={styles.divider} />

        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={createRoom}
          disabled={creating}
        >
          {creating ? "Creating..." : "Create New Room"}
        </button>

        <div style={styles.orText}>or join an existing room</div>

        <div style={styles.joinRow}>
          <input
            style={{ ...styles.input, flex: 1 }}
            type="text"
            placeholder="Room code..."
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
          />
          <button style={styles.button} onClick={joinRoom}>
            Join
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.footer}>
          Powered by{" "}
          <a href="https://www.worldlabs.ai/" target="_blank" rel="noreferrer" style={styles.link}>
            World Labs Marble
          </a>{" "}
          +{" "}
          <a href="https://sparkjs.dev/" target="_blank" rel="noreferrer" style={styles.link}>
            SparkJS
          </a>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%)",
  },
  card: {
    background: "rgba(20, 20, 40, 0.9)",
    border: "1px solid rgba(100, 100, 200, 0.2)",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "440px",
    backdropFilter: "blur(20px)",
  },
  title: {
    fontSize: "32px",
    fontWeight: 700,
    background: "linear-gradient(135deg, #7c7cff, #4ecdc4)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#888",
    fontSize: "14px",
    marginBottom: "28px",
    lineHeight: 1.5,
  },
  section: {
    marginBottom: "16px",
  },
  label: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
    color: "#aaa",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#e0e0e0",
    fontSize: "14px",
    outline: "none",
  },
  divider: {
    height: "1px",
    background: "rgba(255,255,255,0.08)",
    margin: "24px 0",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid rgba(100,100,200,0.3)",
    background: "rgba(100,100,200,0.15)",
    color: "#c0c0ff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
  },
  primaryButton: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, rgba(100,100,200,0.3), rgba(78,205,196,0.3))",
    border: "1px solid rgba(100,100,200,0.4)",
    fontSize: "16px",
  },
  orText: {
    textAlign: "center" as const,
    color: "#666",
    fontSize: "13px",
    margin: "16px 0",
  },
  joinRow: {
    display: "flex",
    gap: "8px",
  },
  error: {
    color: "#ff6b6b",
    fontSize: "13px",
    marginTop: "12px",
    textAlign: "center" as const,
  },
  link: {
    color: "#7c7cff",
    textDecoration: "none",
    fontSize: "12px",
  },
  footer: {
    marginTop: "28px",
    textAlign: "center" as const,
    fontSize: "12px",
    color: "#555",
  },
};
