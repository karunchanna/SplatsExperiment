# Splat World — Multiplayer Explorer

Generate 3D worlds from images using the [World Labs Marble API](https://docs.worldlabs.ai/api) and explore them in real-time with friends. Built with [SparkJS](https://sparkjs.dev/) for Gaussian splat rendering and WebSockets for multiplayer.

## How it works

1. **Create a room** — one player creates a room and gets an invite link
2. **Upload an image** — the host uploads an image (or pastes a URL) and the Marble API generates a 3D Gaussian splat world from it
3. **Explore together** — all players in the room can fly through the generated world in first-person, seeing each other as avatars with nametags
4. **Chat** — built-in text chat for coordination

## Prerequisites

- Node.js 18+
- A [World Labs API key](https://platform.worldlabs.ai/) (entered in the browser, not stored server-side)

## Setup

```bash
npm install
npm run dev
```

This starts both the Vite dev server (port 5173) and the backend (port 3001) concurrently. Open http://localhost:5173.

## Controls

| Key | Action |
|-----|--------|
| Click | Lock cursor / look around |
| WASD | Move forward/back/left/right |
| Space | Fly up |
| Shift | Fly down |
| ESC | Unlock cursor |
| Enter | Send chat message |

## Architecture

```
├── server/index.ts          # Express + WebSocket server
│   ├── Marble API proxy     # Proxies World Labs API calls (keeps key client-side in header)
│   ├── Room management      # Create/join rooms via REST
│   └── WebSocket server     # Real-time player sync, chat, splat sharing
├── src/
│   ├── App.tsx              # Main app with lobby/room state machine
│   ├── components/
│   │   ├── Lobby.tsx        # Room creation & join UI
│   │   ├── SplatViewer.tsx  # THREE.js + SparkJS 3D viewer with first-person controls
│   │   ├── ImageUploader.tsx # Image upload + Marble API world generation
│   │   └── HUD.tsx          # Player list, chat, room info overlay
│   ├── hooks/
│   │   └── useWebSocket.ts  # WebSocket hook for multiplayer state
│   └── utils/
│       └── marbleApi.ts     # Marble API client (upload, generate, poll)
```

## Tech Stack

- **Frontend**: React, THREE.js, SparkJS (Gaussian splat renderer)
- **Backend**: Express, ws (WebSocket)
- **API**: World Labs Marble API for image-to-3D-world generation
- **Build**: Vite, TypeScript
