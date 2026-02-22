# AI Mesh Generator — Roblox Studio Plugin

A Roblox Studio plugin that lets you generate 3-D meshes from text prompts using
Roblox's built-in `AssetService:GenerateModelAsync` and `GenerateTextureAsync` APIs,
preview them in an interactive 3-D viewport, apply textures, and control LOD /
triangle count — all without leaving Studio.

---

## Features

| # | Feature | Details |
|---|---------|---------|
| ① | **Text Prompt** | Free-text description sent to the Roblox AI mesh generator |
| ② | **Bounding Box** | Creates a semi-transparent box in the Workspace as a visual size reference; dimensions are forwarded to the generator as hints |
| ③ | **Generate Mesh** | Calls `AssetService:GenerateModelAsync` and shows progress in the panel |
| ④ | **3-D Preview** | `ViewportFrame` + `WorldModel`; drag to rotate, +/- to zoom |
| ⑤ | **Texture Generation** | Calls `AssetService:GenerateTextureAsync` with your texture description and refreshes the preview |
| ⑥ | **Triangle Count / LOD** | Quick-set RenderFidelity (Auto / Precise / Performance) or enter a custom triangle target; uses `EditableMesh` to read the actual count when available |

---

## Installation

### Option A — Local Plugins folder (recommended for development)

1. Open the folder:
   - **Windows**: `%LOCALAPPDATA%\Roblox\Plugins`
   - **macOS**: `~/Documents/Roblox/Plugins`
2. Copy `AIMeshGenerator.lua` into that folder.
3. Restart Roblox Studio (or run **Plugins › Manage Plugins › Reload**).
4. The **"AI Mesh Generator"** button appears in the **Plugins** toolbar.

### Option B — Publish to Roblox

1. In Studio open a **Plugin** project (File › New › Plugin).
2. Paste the contents of `AIMeshGenerator.lua` into the root `Script`.
3. Go to **File › Publish to Roblox as Plugin**.
4. Fill in the name / description and click **Create**.

---

## Requirements

| Requirement | Notes |
|-------------|-------|
| Roblox Studio | Any recent version (2024+) |
| `AssetService:GenerateModelAsync` | Available to all Studio users; requires a Roblox account in good standing |
| `AssetService:GenerateTextureAsync` | Same requirements; may still be in beta rollout |
| `AssetService:CreateEditableMeshAsync` | Used for reading triangle counts; gracefully falls back if unavailable |

> **Note:** `GenerateModelAsync` and `GenerateTextureAsync` make network calls to
> Roblox's AI backend and may take 30–90 seconds per request.

---

## Usage walkthrough

1. **Click** the toolbar button to open the panel.
2. *(Optional)* Set X/Y/Z values in the **Bounding Box** section and click
   **Create Box** to drop a reference box in the scene.
3. Type a description in the **Text Prompt** box (e.g. `"a weathered wooden barrel"`).
4. Click **▶ Generate Mesh** and wait for the preview to appear.
5. Drag inside the preview viewport to rotate; use **+** / **−** to zoom.
6. *(Optional)* Type a surface description and click **🎨 Generate Texture**.
7. *(Optional)* Pick a **RenderFidelity** preset or enter a custom triangle target and
   click **Apply**.
8. Click **⊕ Add to Workspace** to drop the final model into your scene.

---

## API reference used

```lua
-- Generate a 3-D model from a text prompt
AssetService:GenerateModelAsync(prompt: string, params: table) -> Model

-- Apply AI-generated PBR textures to a MeshPart
AssetService:GenerateTextureAsync(meshPart: MeshPart, params: table)

-- Read editable mesh data (triangle count, vertices, etc.)
AssetService:CreateEditableMeshAsync(content: Content, params: table) -> EditableMesh
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Button doesn't appear | Reload plugins or restart Studio |
| "Error: …" after Generate | Check your internet connection and Roblox account permissions |
| Preview is black | The model may have no visible parts; try a different prompt |
| Texture not applied | `GenerateTextureAsync` may not be available in your Studio version yet |
| Triangle count shows "unavailable" | `CreateEditableMeshAsync` requires the mesh to already be saved to Roblox; use fidelity presets as a workaround |
