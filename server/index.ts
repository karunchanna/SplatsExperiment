import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3001;
const MARBLE_API_BASE = "https://api.worldlabs.ai/marble/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
}

interface Room {
  id: string;
  hostId: string;
  splatUrl: string | null;
  worldId: string | null;
  players: Map<string, Player>;
}

// ─── State ────────────────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();
const PLAYER_COLORS = [
  "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4",
  "#ffeaa7", "#dfe6e9", "#fd79a8", "#a29bfe",
];

// ─── Marble API Routes ───────────────────────────────────────────────────────

// Prepare image upload
app.post("/api/prepare-upload", async (req, res) => {
  const { fileName, extension } = req.body;
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(400).json({ error: "API key required" });
    return;
  }

  try {
    const response = await fetch(
      `${MARBLE_API_BASE}/media-assets:prepare_upload`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "WLT-Api-Key": apiKey,
        },
        body: JSON.stringify({
          file_name: fileName,
          extension: extension,
          kind: "image",
        }),
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("prepare-upload error:", err);
    res.status(500).json({ error: "Failed to prepare upload" });
  }
});

// Generate world from image
app.post("/api/generate-world", async (req, res) => {
  const { mediaAssetId, textPrompt, imageUri } = req.body;
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(400).json({ error: "API key required" });
    return;
  }

  let worldPrompt: Record<string, unknown>;

  if (mediaAssetId) {
    worldPrompt = {
      type: "image",
      image_prompt: {
        source: "media_asset",
        media_asset_id: mediaAssetId,
      },
      ...(textPrompt ? { text_prompt: textPrompt } : {}),
    };
  } else if (imageUri) {
    worldPrompt = {
      type: "image",
      image_prompt: {
        source: "uri",
        uri: imageUri,
      },
      ...(textPrompt ? { text_prompt: textPrompt } : {}),
    };
  } else {
    res.status(400).json({ error: "Either mediaAssetId or imageUri required" });
    return;
  }

  try {
    const response = await fetch(`${MARBLE_API_BASE}/worlds:generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "WLT-Api-Key": apiKey,
      },
      body: JSON.stringify({
        display_name: "Splat World Session",
        world_prompt: worldPrompt,
        model: "Marble 0.1-mini",
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("generate-world error:", err);
    res.status(500).json({ error: "Failed to generate world" });
  }
});

// Poll operation status
app.get("/api/operations/:operationId", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(400).json({ error: "API key required" });
    return;
  }

  try {
    const response = await fetch(
      `${MARBLE_API_BASE}/operations/${req.params.operationId}`,
      {
        headers: { "WLT-Api-Key": apiKey },
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("poll error:", err);
    res.status(500).json({ error: "Failed to poll operation" });
  }
});

// Get world details
app.get("/api/worlds/:worldId", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(400).json({ error: "API key required" });
    return;
  }

  try {
    const response = await fetch(
      `${MARBLE_API_BASE}/worlds/${req.params.worldId}`,
      {
        headers: { "WLT-Api-Key": apiKey },
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("get world error:", err);
    res.status(500).json({ error: "Failed to get world" });
  }
});

// ─── Room Management REST Endpoints ──────────────────────────────────────────

app.post("/api/rooms", (_req, res) => {
  const roomId = uuidv4().slice(0, 8);
  const room: Room = {
    id: roomId,
    hostId: "",
    splatUrl: null,
    worldId: null,
    players: new Map(),
  };
  rooms.set(roomId, room);
  res.json({ roomId });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({
    id: room.id,
    splatUrl: room.splatUrl,
    worldId: room.worldId,
    playerCount: room.players.size,
  });
});

// ─── WebSocket Server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  let playerId: string | null = null;
  let roomId: string | null = null;

  ws.on("message", (raw: Buffer) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "join": {
        roomId = msg.roomId as string;
        const playerName = (msg.name as string) || "Explorer";
        const room = rooms.get(roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }

        playerId = uuidv4().slice(0, 8);
        const colorIndex = room.players.size % PLAYER_COLORS.length;

        if (room.players.size === 0) {
          room.hostId = playerId;
        }

        const player: Player = {
          id: playerId,
          name: playerName,
          ws,
          position: { x: 0, y: 0.5, z: 2 },
          rotation: { x: 0, y: 0, z: 0 },
          color: PLAYER_COLORS[colorIndex],
        };
        room.players.set(playerId, player);

        // Send join confirmation with existing players
        const existingPlayers = Array.from(room.players.values())
          .filter((p) => p.id !== playerId)
          .map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            rotation: p.rotation,
            color: p.color,
          }));

        ws.send(
          JSON.stringify({
            type: "joined",
            playerId,
            color: player.color,
            isHost: room.hostId === playerId,
            splatUrl: room.splatUrl,
            players: existingPlayers,
          })
        );

        // Notify others
        broadcast(room, playerId, {
          type: "player_joined",
          player: {
            id: playerId,
            name: playerName,
            position: player.position,
            rotation: player.rotation,
            color: player.color,
          },
        });
        break;
      }

      case "move": {
        if (!playerId || !roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.get(playerId);
        if (!player) return;

        player.position = msg.position as {
          x: number;
          y: number;
          z: number;
        };
        player.rotation = msg.rotation as {
          x: number;
          y: number;
          z: number;
        };

        broadcast(room, playerId, {
          type: "player_moved",
          playerId,
          position: player.position,
          rotation: player.rotation,
        });
        break;
      }

      case "set_splat": {
        if (!playerId || !roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;

        room.splatUrl = msg.splatUrl as string;
        room.worldId = (msg.worldId as string) || null;

        broadcast(room, null, {
          type: "splat_loaded",
          splatUrl: room.splatUrl,
          worldId: room.worldId,
        });
        break;
      }

      case "chat": {
        if (!playerId || !roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const sender = room.players.get(playerId);
        if (!sender) return;

        broadcast(room, null, {
          type: "chat",
          playerId,
          name: sender.name,
          color: sender.color,
          message: msg.message as string,
        });
        break;
      }
    }
  });

  ws.on("close", () => {
    if (!playerId || !roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(playerId);

    broadcast(room, null, {
      type: "player_left",
      playerId,
    });

    // Clean up empty rooms after a delay
    if (room.players.size === 0) {
      setTimeout(() => {
        if (rooms.get(roomId!)?.players.size === 0) {
          rooms.delete(roomId!);
        }
      }, 60_000);
    }
  });
});

function broadcast(
  room: Room,
  excludeId: string | null,
  message: Record<string, unknown>
) {
  const data = JSON.stringify(message);
  for (const [id, player] of room.players) {
    if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
