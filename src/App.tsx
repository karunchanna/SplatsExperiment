import { useState, useCallback } from "react";
import { Lobby } from "./components/Lobby";
import { SplatViewer } from "./components/SplatViewer";
import { ImageUploader } from "./components/ImageUploader";
import { HUD } from "./components/HUD";
import { useWebSocket } from "./hooks/useWebSocket";

type AppState =
  | { screen: "lobby" }
  | {
      screen: "room";
      roomId: string;
      playerName: string;
      apiKey: string;
    };

export function App() {
  const [state, setState] = useState<AppState>({ screen: "lobby" });
  const [splatUrl, setSplatUrl] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(true);

  const roomId = state.screen === "room" ? state.roomId : null;
  const playerName = state.screen === "room" ? state.playerName : "";
  const apiKey = state.screen === "room" ? state.apiKey : "";

  const handleSplatFromServer = useCallback(
    (url: string) => {
      setSplatUrl(url);
      setShowUploader(false);
    },
    []
  );

  const ws = useWebSocket({
    roomId,
    playerName,
    onSplatLoaded: handleSplatFromServer,
  });

  const handleJoinRoom = (roomId: string, name: string, key: string) => {
    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.pushState({}, "", url.toString());

    setState({ screen: "room", roomId, playerName: name, apiKey: key });
  };

  const handleSplatGenerated = (url: string, worldId: string) => {
    setSplatUrl(url);
    setShowUploader(false);
    ws.sendSplat(url, worldId);
  };

  if (state.screen === "lobby") {
    return <Lobby onJoinRoom={handleJoinRoom} />;
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* 3D Viewer fills the screen */}
      <SplatViewer
        splatUrl={splatUrl}
        remotePlayers={ws.remotePlayers}
        onMove={ws.sendMove}
      />

      {/* HUD overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <HUD
          roomId={state.roomId}
          playerId={ws.playerId}
          playerColor={ws.playerColor}
          playerName={state.playerName}
          isHost={ws.isHost}
          connected={ws.connected}
          remotePlayers={ws.remotePlayers}
          chatMessages={ws.chatMessages}
          onSendChat={ws.sendChat}
        />

        {/* Image uploader panel - top left under the bar */}
        {showUploader && (
          <div style={{ position: "absolute", top: 60, left: 12, pointerEvents: "auto" }}>
            <ImageUploader
              apiKey={state.apiKey}
              onSplatGenerated={handleSplatGenerated}
            />
          </div>
        )}

        {/* Toggle uploader button */}
        {!showUploader && (
          <div style={{ position: "absolute", top: 60, left: 12, pointerEvents: "auto" }}>
            <button
              onClick={() => setShowUploader(true)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(100,100,200,0.3)",
                background: "rgba(15,15,30,0.85)",
                color: "#c0c0ff",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                backdropFilter: "blur(10px)",
              }}
            >
              + New World
            </button>
          </div>
        )}
      </div>

      {/* CSS keyframes for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
