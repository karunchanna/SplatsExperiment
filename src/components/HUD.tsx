import type { RemotePlayer, ChatMessage } from "../hooks/useWebSocket";
import { useState, useRef, useEffect } from "react";

interface HUDProps {
  roomId: string;
  playerId: string | null;
  playerColor: string;
  playerName: string;
  isHost: boolean;
  connected: boolean;
  remotePlayers: Map<string, RemotePlayer>;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void;
}

export function HUD({
  roomId,
  playerId,
  playerColor,
  playerName,
  isHost,
  connected,
  remotePlayers,
  chatMessages,
  onSendChat,
}: HUDProps) {
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const inviteUrl = `${window.location.origin}?room=${roomId}`;

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = () => {
    if (chatInput.trim()) {
      onSendChat(chatInput.trim());
      setChatInput("");
    }
  };

  const allPlayers = [
    { id: playerId, name: `${playerName} (you)`, color: playerColor },
    ...Array.from(remotePlayers.values()),
  ];

  return (
    <>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.roomInfo}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: connected ? "#4ecdc4" : "#ff6b6b",
          }} />
          <span style={styles.roomCode}>Room: {roomId}</span>
          {isHost && <span style={styles.hostBadge}>HOST</span>}
        </div>
        <button style={styles.inviteBtn} onClick={copyInvite}>
          {copied ? "Copied!" : "Copy Invite Link"}
        </button>
      </div>

      {/* Player list */}
      <div style={styles.playerList}>
        <div style={styles.playerListTitle}>
          Players ({allPlayers.length})
        </div>
        {allPlayers.map((p) =>
          p.id ? (
            <div key={p.id} style={styles.playerItem}>
              <span style={{ ...styles.playerDot, background: p.color }} />
              <span style={styles.playerName}>{p.name}</span>
            </div>
          ) : null
        )}
      </div>

      {/* Chat */}
      <div style={{ ...styles.chatPanel, height: chatOpen ? "240px" : "36px" }}>
        <div style={styles.chatHeader} onClick={() => setChatOpen(!chatOpen)}>
          Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
        </div>
        {chatOpen && (
          <>
            <div style={styles.chatMessages}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={styles.chatMsg}>
                  <span style={{ color: msg.color, fontWeight: 600 }}>
                    {msg.name}:
                  </span>{" "}
                  {msg.message}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={styles.chatInputRow}>
              <input
                style={styles.chatInput}
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              />
              <button style={styles.chatSendBtn} onClick={handleSendChat}>
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {/* Controls hint */}
      <div style={styles.controls}>
        <span>Click to look</span>
        <span>WASD to move</span>
        <span>Space/Shift for up/down</span>
        <span>ESC to unlock cursor</span>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "auto",
  } as React.CSSProperties,
  roomInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(15,15,30,0.85)",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(100,100,200,0.15)",
    backdropFilter: "blur(10px)",
  } as React.CSSProperties,
  roomCode: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#c0c0ff",
    fontFamily: "monospace",
  } as React.CSSProperties,
  hostBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    background: "rgba(78,205,196,0.2)",
    color: "#4ecdc4",
    fontWeight: 700,
  } as React.CSSProperties,
  inviteBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid rgba(100,100,200,0.3)",
    background: "rgba(100,100,200,0.15)",
    color: "#c0c0ff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    backdropFilter: "blur(10px)",
  } as React.CSSProperties,
  playerList: {
    position: "absolute",
    top: 60,
    right: 12,
    background: "rgba(15,15,30,0.85)",
    border: "1px solid rgba(100,100,200,0.15)",
    borderRadius: "8px",
    padding: "10px",
    minWidth: "150px",
    backdropFilter: "blur(10px)",
    pointerEvents: "auto",
  } as React.CSSProperties,
  playerListTitle: {
    fontSize: "11px",
    color: "#888",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  } as React.CSSProperties,
  playerItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 0",
  } as React.CSSProperties,
  playerDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  } as React.CSSProperties,
  playerName: {
    fontSize: "13px",
    color: "#ccc",
  } as React.CSSProperties,
  chatPanel: {
    position: "absolute",
    bottom: 50,
    left: 12,
    width: "320px",
    background: "rgba(15,15,30,0.85)",
    border: "1px solid rgba(100,100,200,0.15)",
    borderRadius: "8px",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
    transition: "height 0.2s ease",
    display: "flex",
    flexDirection: "column",
    pointerEvents: "auto",
  } as React.CSSProperties,
  chatHeader: {
    padding: "8px 12px",
    fontSize: "12px",
    color: "#888",
    cursor: "pointer",
    borderBottom: "1px solid rgba(100,100,200,0.1)",
    fontWeight: 600,
  } as React.CSSProperties,
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 12px",
    fontSize: "13px",
    color: "#ccc",
  } as React.CSSProperties,
  chatMsg: {
    marginBottom: "4px",
    lineHeight: 1.4,
  } as React.CSSProperties,
  chatInputRow: {
    display: "flex",
    borderTop: "1px solid rgba(100,100,200,0.1)",
  } as React.CSSProperties,
  chatInput: {
    flex: 1,
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    color: "#e0e0e0",
    fontSize: "13px",
    outline: "none",
  } as React.CSSProperties,
  chatSendBtn: {
    padding: "8px 14px",
    background: "transparent",
    border: "none",
    color: "#7c7cff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
  } as React.CSSProperties,
  controls: {
    position: "absolute",
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "16px",
    fontSize: "11px",
    color: "rgba(255,255,255,0.35)",
    pointerEvents: "none",
  } as React.CSSProperties,
};
