--[[
    AI Mesh Generator Plugin for Roblox Studio
    ============================================
    Features:
      1. Text prompt input for mesh generation
      2. Optional bounding box helper in workspace
      3. GenerateModelAsync mesh generation with 3D preview (drag-to-rotate)
      4. Texture generation via GenerateTextureAsync
      5. Triangle count / LOD control via RenderFidelity + EditableMesh

    Installation:
      - Save this file as AIMeshGenerator.lua in your Roblox Studio Plugins folder
        (usually %LOCALAPPDATA%\Roblox\Plugins on Windows)
      - Or use the Plugin Management dialog in Roblox Studio
]]

-- ─────────────────────────────────────────────────────────────────────────────
-- Services
-- ─────────────────────────────────────────────────────────────────────────────
local AssetService   = game:GetService("AssetService")
local Selection      = game:GetService("Selection")
local RunService     = game:GetService("RunService")

-- ─────────────────────────────────────────────────────────────────────────────
-- Plugin toolbar & toggle button
-- ─────────────────────────────────────────────────────────────────────────────
local toolbar     = plugin:CreateToolbar("AI Mesh Generator")
local toggleBtn   = toolbar:CreateButton(
    "AI Mesh Generator",
    "Open the AI Mesh Generator panel",
    "rbxassetid://6764432847"  -- generic mesh icon; replace with your own asset id
)

-- ─────────────────────────────────────────────────────────────────────────────
-- DockWidget
-- ─────────────────────────────────────────────────────────────────────────────
local widgetInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Float,
    true,   -- initially open
    false,  -- don't override saved state
    420,    -- default width
    650,    -- default height
    320,    -- min width
    420     -- min height
)

local widget = plugin:CreateDockWidgetPluginGui("AIMeshGen_v1", widgetInfo)
widget.Title  = "AI Mesh Generator"
widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

toggleBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- Colour palette
-- ─────────────────────────────────────────────────────────────────────────────
local C = {
    bg          = Color3.fromRGB(32,  32,  36),
    surface     = Color3.fromRGB(48,  48,  54),
    border      = Color3.fromRGB(72,  72,  80),
    text        = Color3.fromRGB(220, 220, 225),
    subtext     = Color3.fromRGB(140, 140, 150),
    accent      = Color3.fromRGB(82,  130, 255),
    green       = Color3.fromRGB(60,  190,  90),
    red         = Color3.fromRGB(210,  70,  70),
    amber       = Color3.fromRGB(220, 160,  50),
    purple      = Color3.fromRGB(160,  80, 210),
    teal        = Color3.fromRGB(40,  180, 170),
    dim         = Color3.fromRGB(80,   80,  90),
}

-- ─────────────────────────────────────────────────────────────────────────────
-- UI helper functions
-- ─────────────────────────────────────────────────────────────────────────────
local function corner(parent, radius)
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, radius or 6)
    c.Parent = parent
    return c
end

local function pad(parent, px)
    local p = Instance.new("UIPadding")
    p.PaddingLeft   = UDim.new(0, px)
    p.PaddingRight  = UDim.new(0, px)
    p.PaddingTop    = UDim.new(0, px)
    p.PaddingBottom = UDim.new(0, px)
    p.Parent = parent
end

local function listLayout(parent, spacing, dir)
    local l = Instance.new("UIListLayout")
    l.SortOrder      = Enum.SortOrder.LayoutOrder
    l.FillDirection  = dir or Enum.FillDirection.Vertical
    l.Padding        = UDim.new(0, spacing or 6)
    l.Parent         = parent
    return l
end

local function label(text, parent, order, size, colour, bold, wrap)
    local lbl = Instance.new("TextLabel")
    lbl.Size                = UDim2.new(1, 0, 0, size or 18)
    lbl.Text                = text
    lbl.TextColor3          = colour or C.text
    lbl.BackgroundTransparency = 1
    lbl.TextXAlignment      = Enum.TextXAlignment.Left
    lbl.Font                = bold and Enum.Font.GothamBold or Enum.Font.Gotham
    lbl.TextSize            = 12
    lbl.TextWrapped         = wrap or false
    lbl.LayoutOrder         = order or 0
    lbl.Parent              = parent
    return lbl
end

local function sectionHeader(text, parent, order)
    local f = Instance.new("Frame")
    f.Size            = UDim2.new(1, 0, 0, 24)
    f.BackgroundColor3 = Color3.fromRGB(55, 55, 65)
    f.BorderSizePixel = 0
    f.LayoutOrder     = order
    f.Parent          = parent
    corner(f, 4)

    local lbl = Instance.new("TextLabel")
    lbl.Size           = UDim2.new(1, -10, 1, 0)
    lbl.Position       = UDim2.new(0, 8, 0, 0)
    lbl.Text           = text
    lbl.TextColor3     = C.accent
    lbl.BackgroundTransparency = 1
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Font           = Enum.Font.GothamBold
    lbl.TextSize       = 12
    lbl.Parent         = f
    return f
end

local function textbox(placeholder, parent, order, height, multiline)
    local box = Instance.new("TextBox")
    box.Size             = UDim2.new(1, 0, 0, height or 30)
    box.PlaceholderText  = placeholder
    box.Text             = ""
    box.BackgroundColor3 = C.surface
    box.TextColor3       = C.text
    box.PlaceholderColor3= C.subtext
    box.Font             = Enum.Font.Gotham
    box.TextSize         = 12
    box.ClearTextOnFocus = false
    box.TextXAlignment   = Enum.TextXAlignment.Left
    box.MultiLine        = multiline or false
    box.TextWrapped      = multiline or false
    box.LayoutOrder      = order or 0
    box.Parent           = parent
    corner(box)
    local p = Instance.new("UIPadding")
    p.PaddingLeft  = UDim.new(0, 8)
    p.PaddingRight = UDim.new(0, 8)
    p.Parent = box
    return box
end

local function button(text, colour, parent, order, h)
    local btn = Instance.new("TextButton")
    btn.Size             = UDim2.new(1, 0, 0, h or 30)
    btn.Text             = text
    btn.BackgroundColor3 = colour or C.accent
    btn.TextColor3       = Color3.new(1, 1, 1)
    btn.Font             = Enum.Font.GothamBold
    btn.TextSize         = 12
    btn.AutoButtonColor  = true
    btn.LayoutOrder      = order or 0
    btn.Parent           = parent
    corner(btn)
    return btn
end

local function separator(parent, order)
    local f = Instance.new("Frame")
    f.Size            = UDim2.new(1, 0, 0, 1)
    f.BackgroundColor3 = C.border
    f.BorderSizePixel = 0
    f.LayoutOrder     = order
    f.Parent          = parent
end

local function statusLabel(parent, order)
    local lbl = Instance.new("TextLabel")
    lbl.Size                   = UDim2.new(1, 0, 0, 20)
    lbl.Text                   = ""
    lbl.TextColor3             = C.subtext
    lbl.BackgroundTransparency = 1
    lbl.TextXAlignment         = Enum.TextXAlignment.Left
    lbl.Font                   = Enum.Font.Gotham
    lbl.TextSize               = 11
    lbl.TextWrapped            = true
    lbl.LayoutOrder            = order or 0
    lbl.Parent                 = parent
    return lbl
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Root layout
-- ─────────────────────────────────────────────────────────────────────────────
local root = Instance.new("Frame")
root.Size             = UDim2.new(1, 0, 1, 0)
root.BackgroundColor3 = C.bg
root.BorderSizePixel  = 0
root.Parent           = widget

local scroll = Instance.new("ScrollingFrame")
scroll.Size               = UDim2.new(1, 0, 1, 0)
scroll.BackgroundTransparency = 1
scroll.ScrollBarThickness = 5
scroll.ScrollBarImageColor3 = C.border
scroll.CanvasSize         = UDim2.new(0, 0, 0, 0)
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
scroll.Parent             = root

local contentList = listLayout(scroll, 8)
pad(scroll, 10)

-- ─────────────────────────────────────────────────────────────────────────────
-- Plugin state
-- ─────────────────────────────────────────────────────────────────────────────
local generatedModel   = nil  -- the Model returned by GenerateModelAsync
local boundingBoxPart  = nil  -- the workspace Part used as bounding-box helper
local previewModel     = nil  -- clone living inside the ViewportFrame
local modelRotX        = -0.3
local modelRotY        =  0.5
local camDist          =  8
local isDragging       = false
local lastDragPos      = nil

-- ─────────────────────────────────────────────────────────────────────────────
-- ❶  TEXT PROMPT
-- ─────────────────────────────────────────────────────────────────────────────
sectionHeader("① Text Prompt", scroll, 10)

local promptBox = textbox(
    "Describe the 3D mesh to generate…  e.g. 'a detailed oak tree'",
    scroll, 11, 56, true
)

-- ─────────────────────────────────────────────────────────────────────────────
-- ❷  BOUNDING BOX
-- ─────────────────────────────────────────────────────────────────────────────
sectionHeader("② Bounding Box  (optional size reference)", scroll, 20)

-- Size row (X / Y / Z)
local sizeRow = Instance.new("Frame")
sizeRow.Size             = UDim2.new(1, 0, 0, 28)
sizeRow.BackgroundTransparency = 1
sizeRow.LayoutOrder      = 21
sizeRow.Parent           = scroll
listLayout(sizeRow, 4, Enum.FillDirection.Horizontal)

local function sizeField(axis, parent)
    local wrap = Instance.new("Frame")
    wrap.Size             = UDim2.new(0.333, -4, 1, 0)
    wrap.BackgroundTransparency = 1
    wrap.Parent           = parent

    local axisLbl = Instance.new("TextLabel")
    axisLbl.Size             = UDim2.new(0, 18, 1, 0)
    axisLbl.Text             = axis
    axisLbl.TextColor3       = C.subtext
    axisLbl.BackgroundTransparency = 1
    axisLbl.Font             = Enum.Font.GothamBold
    axisLbl.TextSize         = 12
    axisLbl.TextXAlignment   = Enum.TextXAlignment.Left
    axisLbl.Parent           = wrap

    local inp = Instance.new("TextBox")
    inp.Size             = UDim2.new(1, -20, 1, 0)
    inp.Position         = UDim2.new(0, 20, 0, 0)
    inp.Text             = "10"
    inp.BackgroundColor3 = C.surface
    inp.TextColor3       = C.text
    inp.Font             = Enum.Font.Gotham
    inp.TextSize         = 12
    inp.ClearTextOnFocus = false
    inp.Parent           = wrap
    corner(inp, 4)
    return inp
end

local bbX = sizeField("X", sizeRow)
local bbY = sizeField("Y", sizeRow)
local bbZ = sizeField("Z", sizeRow)

local bbBtnRow = Instance.new("Frame")
bbBtnRow.Size             = UDim2.new(1, 0, 0, 28)
bbBtnRow.BackgroundTransparency = 1
bbBtnRow.LayoutOrder      = 22
bbBtnRow.Parent           = scroll
local bbBtnLayout = listLayout(bbBtnRow, 4, Enum.FillDirection.Horizontal)

local createBBBtn = button("Create Box", C.teal,              bbBtnRow, 1)
createBBBtn.Size  = UDim2.new(0.5, -2, 1, 0)
local removeBBBtn = button("Remove Box", Color3.fromRGB(130,50,50), bbBtnRow, 2)
removeBBBtn.Size  = UDim2.new(0.5, -2, 1, 0)

local bbStatus = statusLabel(scroll, 23)

createBBBtn.MouseButton1Click:Connect(function()
    if boundingBoxPart then boundingBoxPart:Destroy() end

    local sx = tonumber(bbX.Text) or 10
    local sy = tonumber(bbY.Text) or 10
    local sz = tonumber(bbZ.Text) or 10

    local part = Instance.new("Part")
    part.Name         = "AIMeshGen_BoundingBox"
    part.Size         = Vector3.new(sx, sy, sz)
    part.CFrame       = CFrame.new(0, sy / 2, 0)
    part.Anchored     = true
    part.CanCollide   = false
    part.Transparency = 0.85
    part.BrickColor   = BrickColor.new("Bright blue")
    part.Material     = Enum.Material.Neon
    part.Parent       = workspace

    local sel = Instance.new("SelectionBox")
    sel.Adornee            = part
    sel.Color3             = Color3.fromRGB(80, 160, 255)
    sel.LineThickness      = 0.06
    sel.SurfaceTransparency = 0.9
    sel.SurfaceColor3      = Color3.fromRGB(80, 160, 255)
    sel.Parent             = part

    boundingBoxPart = part
    Selection:Set({ part })
    bbStatus.Text      = string.format("Box created: %dx%dx%d studs", sx, sy, sz)
    bbStatus.TextColor3 = C.green
end)

removeBBBtn.MouseButton1Click:Connect(function()
    if boundingBoxPart then
        boundingBoxPart:Destroy()
        boundingBoxPart = nil
        bbStatus.Text       = "Bounding box removed."
        bbStatus.TextColor3 = C.subtext
    end
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- ❸  GENERATE MESH
-- ─────────────────────────────────────────────────────────────────────────────
sectionHeader("③ Generate Mesh", scroll, 30)

local genBtn    = button("▶  Generate Mesh", C.accent, scroll, 31, 34)
local genStatus = statusLabel(scroll, 32)
genStatus.Size        = UDim2.new(1, 0, 0, 42)
genStatus.TextWrapped = true

-- ─────────────────────────────────────────────────────────────────────────────
-- ❹  VIEWPORT PREVIEW
-- ─────────────────────────────────────────────────────────────────────────────
sectionHeader("④ Preview  —  drag to rotate", scroll, 40)

-- ViewportFrame
local vp = Instance.new("ViewportFrame")
vp.Size             = UDim2.new(1, 0, 0, 220)
vp.BackgroundColor3 = Color3.fromRGB(22, 22, 28)
vp.LayoutOrder      = 41
vp.Parent           = scroll
corner(vp, 6)

-- WorldModel holds the preview geometry
local vpWorld = Instance.new("WorldModel")
vpWorld.Parent = vp

-- Camera
local vpCam = Instance.new("Camera")
vpCam.Parent = vp
vp.CurrentCamera = vpCam

-- Add a light so the model is visible
local vpLight = Instance.new("PointLight")
vpLight.Brightness = 6
vpLight.Range      = 200

local function updateCamera()
    if not previewModel then return end
    -- GetBoundingBox() replaced deprecated GetModelCFrame()
    local cf, size = previewModel:GetBoundingBox()
    local maxDim   = math.max(size.X, size.Y, size.Z)
    local dist     = camDist + maxDim * 1.2

    local offset = Vector3.new(
        math.sin(modelRotY) * math.cos(modelRotX),
        math.sin(modelRotX),
        math.cos(modelRotY) * math.cos(modelRotX)
    ) * dist

    vpCam.CFrame = CFrame.lookAt(cf.Position + offset, cf.Position)
end

local function loadPreview(model)
    -- Clear old preview
    for _, c in ipairs(vpWorld:GetChildren()) do c:Destroy() end

    local clone = model:Clone()
    clone.Parent = vpWorld

    -- Attach light to first MeshPart, or to the model's primary part
    local lightTarget = clone.PrimaryPart
    for _, d in ipairs(clone:GetDescendants()) do
        if d:IsA("BasePart") then lightTarget = d; break end
    end
    if lightTarget then
        vpLight:Clone().Parent = lightTarget
    end

    previewModel = clone

    -- Auto-fit camera using GetBoundingBox (returns CFrame, Vector3)
    local _, bbSize = clone:GetBoundingBox()
    camDist = math.max(bbSize.X, bbSize.Y, bbSize.Z) * 1.0
    modelRotX, modelRotY = -0.25, 0.6
    updateCamera()
end

-- Drag-to-rotate
vp.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        isDragging   = true
        lastDragPos  = input.Position
    end
end)
vp.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        isDragging  = false
        lastDragPos = nil
    end
end)
vp.InputChanged:Connect(function(input)
    if isDragging and input.UserInputType == Enum.UserInputType.MouseMovement and lastDragPos then
        local delta  = input.Position - lastDragPos
        modelRotY    = modelRotY + delta.X * 0.012
        modelRotX    = math.clamp(modelRotX - delta.Y * 0.012, -math.pi * 0.45, math.pi * 0.45)
        lastDragPos  = input.Position
        updateCamera()
    end
end)

-- Zoom row
local zoomRow = Instance.new("Frame")
zoomRow.Size             = UDim2.new(1, 0, 0, 26)
zoomRow.BackgroundTransparency = 1
zoomRow.LayoutOrder      = 42
zoomRow.Parent           = scroll
listLayout(zoomRow, 4, Enum.FillDirection.Horizontal)

local zoomOutBtn = button("−", C.dim, zoomRow, 1); zoomOutBtn.Size = UDim2.new(0, 34, 1, 0)
local zoomLbl    = label("Zoom", zoomRow, 2, nil, C.subtext)
zoomLbl.Size     = UDim2.new(1, -76, 1, 0)
zoomLbl.TextXAlignment = Enum.TextXAlignment.Center
local zoomInBtn  = button("+", C.dim, zoomRow, 3); zoomInBtn.Size  = UDim2.new(0, 34, 1, 0)

zoomInBtn.MouseButton1Click:Connect(function()
    camDist = math.max(1, camDist - 2); updateCamera()
end)
zoomOutBtn.MouseButton1Click:Connect(function()
    camDist = camDist + 2; updateCamera()
end)

-- "Add to workspace" button
local addBtn = button("⊕  Add to Workspace", C.green, scroll, 43, 30)
local addStatus = statusLabel(scroll, 44)

addBtn.MouseButton1Click:Connect(function()
    if not generatedModel then
        addStatus.Text       = "Generate a mesh first."
        addStatus.TextColor3 = C.amber
        return
    end
    local clone = generatedModel:Clone()
    if boundingBoxPart then
        local bbCF  = boundingBoxPart.CFrame
        local ext   = clone:GetExtentsSize()
        clone:PivotTo(CFrame.new(bbCF.Position + Vector3.new(0, ext.Y / 2, 0)))
    else
        clone:PivotTo(CFrame.new(0, 5, 0))
    end
    clone.Parent = workspace
    Selection:Set({ clone })
    addStatus.Text       = "Model added to Workspace and selected."
    addStatus.TextColor3 = C.green
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- ❸  Generate mesh logic (wired here so viewport is already set up)
-- ─────────────────────────────────────────────────────────────────────────────
genBtn.MouseButton1Click:Connect(function()
    local prompt = promptBox.Text
    if prompt == "" then
        genStatus.Text       = "⚠  Enter a text prompt first."
        genStatus.TextColor3 = C.amber
        return
    end

    genBtn.Active            = false
    genBtn.BackgroundColor3  = C.dim
    genBtn.Text              = "Generating…  (may take 30–60 s)"
    genStatus.Text           = "Sending request to Roblox AI…"
    genStatus.TextColor3     = C.amber

    task.spawn(function()
        -- Step 1: generate the model
        local ok, result = pcall(function()
            -- GenerateModelAsync only accepts an optional { seed: number } table.
            -- DimensionX/Y/Z and Description are NOT valid option keys – they would
            -- cause the call to error. The prompt itself is the first argument.
            return AssetService:GenerateModelAsync(prompt, {})
        end)

        if not ok then
            genStatus.Text       = "✖  Generate error: " .. tostring(result)
            genStatus.TextColor3 = C.red
            genBtn.Active           = true
            genBtn.BackgroundColor3 = C.accent
            genBtn.Text             = "▶  Generate Mesh"
            return
        end

        generatedModel = result
        genStatus.Text       = "✔  Mesh generated!  Loading preview…"
        genStatus.TextColor3 = C.green

        -- Step 2: load into viewport (separate pcall so a preview crash
        --         doesn't hide the success or re-lock the button)
        local pvOk, pvErr = pcall(loadPreview, result)
        if pvOk then
            genStatus.Text = "✔  Mesh generated!  Drag the preview to rotate."
        else
            genStatus.Text = "✔  Mesh generated  (preview error: " .. tostring(pvErr) .. ")"
        end

        genBtn.Active           = true
        genBtn.BackgroundColor3 = C.accent
        genBtn.Text             = "▶  Generate Mesh"
    end)
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- ❺  TEXTURE GENERATION
-- ─────────────────────────────────────────────────────────────────────────────
sectionHeader("⑤ Generate Texture", scroll, 50)

local texPrompt  = textbox("Describe the surface texture…  e.g. 'mossy stone'", scroll, 51, 40, true)
local texBtn     = button("🎨  Generate Texture", C.purple, scroll, 52, 30)
local texStatus  = statusLabel(scroll, 53)
texStatus.Size   = UDim2.new(1, 0, 0, 30)

texBtn.MouseButton1Click:Connect(function()
    if not generatedModel then
        texStatus.Text       = "⚠  Generate a mesh first."
        texStatus.TextColor3 = C.amber
        return
    end
    local desc = texPrompt.Text
    if desc == "" then
        texStatus.Text       = "⚠  Enter a texture description."
        texStatus.TextColor3 = C.amber
        return
    end

    -- Find the first MeshPart in the model
    local targetMesh = nil
    for _, d in ipairs(generatedModel:GetDescendants()) do
        if d:IsA("MeshPart") then targetMesh = d; break end
    end
    if not targetMesh then
        texStatus.Text       = "✖  No MeshPart found in the generated model."
        texStatus.TextColor3 = C.red
        return
    end

    texBtn.Active           = false
    texBtn.BackgroundColor3 = C.dim
    texBtn.Text             = "Generating texture…"
    texStatus.Text          = "Requesting texture from Roblox AI…"
    texStatus.TextColor3    = C.amber

    task.spawn(function()
        local ok, err = pcall(function()
            -- The options table key is lowercase "prompt", not "Description"
            AssetService:GenerateTextureAsync(targetMesh, { prompt = desc })
        end)

        if ok then
            -- Refresh preview to show the new texture
            loadPreview(generatedModel)
            texStatus.Text       = "✔  Texture applied!  Check the preview."
            texStatus.TextColor3 = C.green
        else
            texStatus.Text       = "✖  Error: " .. tostring(err)
            texStatus.TextColor3 = C.red
        end

        texBtn.Active           = true
        texBtn.BackgroundColor3 = C.purple
        texBtn.Text             = "🎨  Generate Texture"
    end)
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- ❻  TRIANGLE COUNT / LOD
-- ─────────────────────────────────────────────────────────────────────────────
sectionHeader("⑥ Triangle Count / LOD", scroll, 60)

local triInfoLbl = label("Triangle info: generate a mesh first.", scroll, 61, 18, C.subtext)

-- RenderFidelity quick-set row
local fidLabel = label("Render Fidelity:", scroll, 62, 18, C.subtext)

local fidRow = Instance.new("Frame")
fidRow.Size             = UDim2.new(1, 0, 0, 28)
fidRow.BackgroundTransparency = 1
fidRow.LayoutOrder      = 63
fidRow.Parent           = scroll
listLayout(fidRow, 4, Enum.FillDirection.Horizontal)

local fidOptions = {
    { label = "Auto",        value = Enum.RenderFidelity.Automatic,   col = C.dim    },
    { label = "Precise",     value = Enum.RenderFidelity.Precise,      col = C.teal   },
    { label = "Performance", value = Enum.RenderFidelity.Performance,  col = C.amber  },
}

local function applyFidelity(fidelity)
    if not generatedModel then return end
    for _, d in ipairs(generatedModel:GetDescendants()) do
        if d:IsA("MeshPart") then d.RenderFidelity = fidelity end
    end
    -- Also refresh preview geometry
    if previewModel then
        for _, d in ipairs(previewModel:GetDescendants()) do
            if d:IsA("MeshPart") then d.RenderFidelity = fidelity end
        end
    end
end

for _, opt in ipairs(fidOptions) do
    local b = button(opt.label, opt.col, fidRow, 1)
    b.Size = UDim2.new(0.333, -4, 1, 0)
    b.MouseButton1Click:Connect(function()
        applyFidelity(opt.value)
        triInfoLbl.Text       = "Fidelity set to: " .. opt.label
        triInfoLbl.TextColor3 = C.green
    end)
end

-- Custom triangle target row
local triHintLbl = label(
    "Custom target (uses EditableMesh when available; otherwise maps to fidelity preset):",
    scroll, 64, 28, C.subtext, false, true
)

local triRow = Instance.new("Frame")
triRow.Size             = UDim2.new(1, 0, 0, 28)
triRow.BackgroundTransparency = 1
triRow.LayoutOrder      = 65
triRow.Parent           = scroll
listLayout(triRow, 4, Enum.FillDirection.Horizontal)

local triLbl = label("Target:", triRow, 1, nil, C.subtext)
triLbl.Size  = UDim2.new(0, 52, 1, 0)
local triInput = textbox("e.g. 1000", triRow, 2, 28)
triInput.Size  = UDim2.new(0, 90, 1, 0)
local applyTriBtn = button("Apply", C.amber, triRow, 3)
applyTriBtn.Size   = UDim2.new(1, -150, 1, 0)

local triStatus = statusLabel(scroll, 66)

-- Count triangles via EditableMesh (Studio only, requires mesh to be a Roblox asset)
-- Falls back gracefully when unavailable.
local function getTriangleCount(meshPart)
    local ok, result = pcall(function()
        -- Content.fromUri wraps a rbxassetid:// URI
        local content = Content.fromUri(meshPart.MeshId)
        local em = AssetService:CreateEditableMeshAsync(content)
        if em then
            -- GetFaces() returns a list of face IDs; each face is one triangle
            local faces = em:GetFaces()
            return faces and #faces or nil
        end
        return nil
    end)
    if ok then return result end
    return nil
end

applyTriBtn.MouseButton1Click:Connect(function()
    if not generatedModel then
        triStatus.Text       = "⚠  Generate a mesh first."
        triStatus.TextColor3 = C.amber
        return
    end
    local target = tonumber(triInput.Text)
    if not target or target <= 0 then
        triStatus.Text       = "⚠  Enter a valid positive number."
        triStatus.TextColor3 = C.amber
        return
    end

    applyTriBtn.Active           = false
    applyTriBtn.BackgroundColor3 = C.dim
    applyTriBtn.Text             = "…"
    triStatus.Text               = "Analysing mesh…"
    triStatus.TextColor3         = C.amber

    task.spawn(function()
        local bestMesh = nil
        for _, d in ipairs(generatedModel:GetDescendants()) do
            if d:IsA("MeshPart") then bestMesh = d; break end
        end

        local currentTris = bestMesh and getTriangleCount(bestMesh)

        if currentTris then
            triInfoLbl.Text       = string.format("Current triangles: %d  |  Target: %d", currentTris, target)
            triInfoLbl.TextColor3 = C.text

            if currentTris <= target then
                triStatus.Text       = "✔  Mesh already within target triangle count."
                triStatus.TextColor3 = C.green
            else
                -- Roblox does not expose direct run-time mesh decimation outside of Studio
                -- tooling; we fall back to RenderFidelity mapping.
                if target < 500 then
                    applyFidelity(Enum.RenderFidelity.Performance)
                    triStatus.Text = string.format(
                        "Applied Performance fidelity (was %d tris, target %d).", currentTris, target)
                elseif target < 5000 then
                    applyFidelity(Enum.RenderFidelity.Automatic)
                    triStatus.Text = string.format(
                        "Applied Automatic fidelity (was %d tris, target %d).", currentTris, target)
                else
                    applyFidelity(Enum.RenderFidelity.Precise)
                    triStatus.Text = string.format(
                        "Applied Precise fidelity (was %d tris, target %d).", currentTris, target)
                end
                triStatus.TextColor3 = C.green
            end
        else
            -- EditableMesh unavailable – use heuristic only
            if target < 500 then
                applyFidelity(Enum.RenderFidelity.Performance)
                triStatus.Text = "Applied Performance fidelity (target < 500)."
            elseif target < 5000 then
                applyFidelity(Enum.RenderFidelity.Automatic)
                triStatus.Text = "Applied Automatic fidelity (target < 5 000)."
            else
                applyFidelity(Enum.RenderFidelity.Precise)
                triStatus.Text = "Applied Precise fidelity (target ≥ 5 000)."
            end
            triStatus.TextColor3 = C.green
            triInfoLbl.Text       = "Triangle count unavailable (EditableMesh API not accessible here)."
            triInfoLbl.TextColor3 = C.subtext
        end

        applyTriBtn.Active           = true
        applyTriBtn.BackgroundColor3 = C.amber
        applyTriBtn.Text             = "Apply"
    end)
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- ❼  RESET
-- ─────────────────────────────────────────────────────────────────────────────
separator(scroll, 70)

local resetBtn = button("↺  Reset  /  Clear All", C.red, scroll, 71, 30)
resetBtn.MouseButton1Click:Connect(function()
    generatedModel  = nil
    previewModel    = nil

    for _, c in ipairs(vpWorld:GetChildren()) do c:Destroy() end

    if boundingBoxPart then
        boundingBoxPart:Destroy()
        boundingBoxPart = nil
    end

    promptBox.Text    = ""
    texPrompt.Text    = ""
    triInput.Text     = ""

    genStatus.Text       = ""
    addStatus.Text       = ""
    texStatus.Text       = ""
    triStatus.Text       = ""
    triInfoLbl.Text      = "Triangle info: generate a mesh first."
    triInfoLbl.TextColor3= C.subtext
    bbStatus.Text        = ""

    vpCam.CFrame = CFrame.new(0, 0, 10)
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup on plugin unload
-- ─────────────────────────────────────────────────────────────────────────────
plugin.Unloading:Connect(function()
    if boundingBoxPart and boundingBoxPart.Parent then
        boundingBoxPart:Destroy()
    end
end)
