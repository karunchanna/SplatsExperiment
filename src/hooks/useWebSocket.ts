import { useRef, useEffect, useCallback, useState } from "react";

export interface RemotePlayer {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
}

export interface ChatMessage {
  playerId: string;
  name: string;
  color: string;
  message: string;
  timestamp: number;
}

interface UseWebSocketOpts {
  roomId: string | null;
  playerName: string;
  onSplatLoaded?: (splatUrl: string, worldId: string | null) => void;
}

export function useWebSocket({ roomId, playerName, onSplatLoaded }: UseWebSocketOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState("#ffffff");
  const [isHost, setIsHost] = useState(false);
  const [remotePlayers, setRemotePlayers] = useState<Map<string, RemotePlayer>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const onSplatLoadedRef = useRef(onSplatLoaded);
  onSplatLoadedRef.current = onSplatLoaded;

  useEffect(() => {
    if (!roomId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", roomId, name: playerName }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "joined": {
          setConnected(true);
          setPlayerId(msg.playerId);
          setPlayerColor(msg.color);
          setIsHost(msg.isHost);

          // Load existing players
          const existing = new Map<string, RemotePlayer>();
          for (const p of msg.players) {
            existing.set(p.id, p);
          }
          setRemotePlayers(existing);

          // Load splat if room already has one
          if (msg.splatUrl) {
            onSplatLoadedRef.current?.(msg.splatUrl, null);
          }
          break;
        }

        case "player_joined": {
          setRemotePlayers((prev) => {
            const next = new Map(prev);
            next.set(msg.player.id, msg.player);
            return next;
          });
          break;
        }

        case "player_moved": {
          setRemotePlayers((prev) => {
            const next = new Map(prev);
            const existing = next.get(msg.playerId);
            if (existing) {
              next.set(msg.playerId, {
                ...existing,
                position: msg.position,
                rotation: msg.rotation,
              });
            }
            return next;
          });
          break;
        }

        case "player_left": {
          setRemotePlayers((prev) => {
            const next = new Map(prev);
            next.delete(msg.playerId);
            return next;
          });
          break;
        }

        case "splat_loaded": {
          onSplatLoadedRef.current?.(msg.splatUrl, msg.worldId);
          break;
        }

        case "chat": {
          setChatMessages((prev) => [
            ...prev.slice(-49),
            {
              playerId: msg.playerId,
              name: msg.name,
              color: msg.color,
              message: msg.message,
              timestamp: Date.now(),
            },
          ]);
          break;
        }

        case "error": {
          console.error("WebSocket error:", msg.message);
          break;
        }
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, playerName]);

  const sendMove = useCallback(
    (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "move", position, rotation }));
      }
    },
    []
  );

  const sendSplat = useCallback(
    (splatUrl: string, worldId?: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "set_splat", splatUrl, worldId }));
      }
    },
    []
  );

  const sendChat = useCallback(
    (message: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "chat", message }));
      }
    },
    []
  );

  return {
    connected,
    playerId,
    playerColor,
    isHost,
    remotePlayers,
    chatMessages,
    sendMove,
    sendSplat,
    sendChat,
  };
}
