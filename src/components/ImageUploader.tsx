import { useState, useRef } from "react";
import {
  prepareUpload,
  uploadFile,
  generateWorld,
  pollUntilDone,
  getSplatUrl,
} from "../utils/marbleApi";

interface ImageUploaderProps {
  apiKey: string;
  onSplatGenerated: (splatUrl: string, worldId: string) => void;
}

type Stage = "idle" | "uploading" | "generating" | "done" | "error";

export function ImageUploader({ apiKey, onSplatGenerated }: ImageUploaderProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [statusText, setStatusText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [useUrlMode, setUseUrlMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    setStage("uploading");
    setStatusText("Preparing...");

    try {
      let mediaAssetId: string | undefined;
      let imageUri: string | undefined;

      if (useUrlMode && imageUrl.trim()) {
        imageUri = imageUrl.trim();
        setStatusText("Starting world generation...");
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setStage("error");
          setStatusText("No image selected");
          return;
        }

        setStatusText("Uploading image...");
        const ext = file.name.split(".").pop() || "jpg";
        const upload = await prepareUpload(apiKey, file.name, ext);

        await uploadFile(
          upload.upload_info.upload_url,
          file,
          upload.upload_info.required_headers
        );

        mediaAssetId = upload.media_asset.media_asset_id;
        setStatusText("Image uploaded. Starting world generation...");
      }

      setStage("generating");
      const { operation_id } = await generateWorld(apiKey, {
        mediaAssetId,
        imageUri,
        textPrompt: textPrompt.trim() || undefined,
      });

      const result = await pollUntilDone(apiKey, operation_id, (status) => {
        setStatusText(status);
      });

      const splatUrl = getSplatUrl(result, "full_res");
      if (!splatUrl) {
        setStage("error");
        setStatusText("World generated but no splat URL found. You may need a paid plan for splat exports.");
        return;
      }

      const worldId = result.response?.world_id || "";
      setStage("done");
      setStatusText("World ready!");
      onSplatGenerated(splatUrl, worldId);
    } catch (err) {
      setStage("error");
      setStatusText(err instanceof Error ? err.message : "Generation failed");
    }
  };

  const isProcessing = stage === "uploading" || stage === "generating";

  return (
    <div style={styles.panel}>
      <h3 style={styles.heading}>Generate World</h3>

      <div style={styles.modeToggle}>
        <button
          style={{ ...styles.modeBtn, ...(!useUrlMode ? styles.modeBtnActive : {}) }}
          onClick={() => setUseUrlMode(false)}
        >
          Upload File
        </button>
        <button
          style={{ ...styles.modeBtn, ...(useUrlMode ? styles.modeBtnActive : {}) }}
          onClick={() => setUseUrlMode(true)}
        >
          Image URL
        </button>
      </div>

      {useUrlMode ? (
        <input
          style={styles.input}
          type="text"
          placeholder="https://example.com/image.jpg"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          disabled={isProcessing}
        />
      ) : (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <button
            style={styles.uploadBtn}
            onClick={() => fileRef.current?.click()}
            disabled={isProcessing}
          >
            {preview ? "Change Image" : "Select Image"}
          </button>
          {preview && (
            <img src={preview} alt="Preview" style={styles.preview} />
          )}
        </div>
      )}

      <input
        style={{ ...styles.input, marginTop: "8px" }}
        type="text"
        placeholder="Optional: describe the scene..."
        value={textPrompt}
        onChange={(e) => setTextPrompt(e.target.value)}
        disabled={isProcessing}
      />

      <button
        style={{
          ...styles.generateBtn,
          opacity: isProcessing ? 0.6 : 1,
        }}
        onClick={generate}
        disabled={isProcessing}
      >
        {isProcessing ? "Generating..." : "Generate Splat World"}
      </button>

      {statusText && (
        <div
          style={{
            ...styles.status,
            color: stage === "error" ? "#ff6b6b" : stage === "done" ? "#4ecdc4" : "#aaa",
          }}
        >
          {stage === "generating" && (
            <span style={styles.spinner} />
          )}
          {statusText}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: "rgba(15, 15, 30, 0.92)",
    border: "1px solid rgba(100, 100, 200, 0.15)",
    borderRadius: "12px",
    padding: "16px",
    width: "300px",
    backdropFilter: "blur(10px)",
  },
  heading: {
    margin: "0 0 12px",
    fontSize: "14px",
    color: "#c0c0ff",
    fontWeight: 600,
  },
  modeToggle: {
    display: "flex",
    gap: "4px",
    marginBottom: "10px",
  },
  modeBtn: {
    flex: 1,
    padding: "6px",
    fontSize: "12px",
    border: "1px solid rgba(100,100,200,0.15)",
    borderRadius: "6px",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
  },
  modeBtnActive: {
    background: "rgba(100,100,200,0.15)",
    color: "#c0c0ff",
    borderColor: "rgba(100,100,200,0.3)",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    color: "#e0e0e0",
    fontSize: "13px",
    outline: "none",
  },
  uploadBtn: {
    width: "100%",
    padding: "20px",
    border: "2px dashed rgba(100,100,200,0.3)",
    borderRadius: "8px",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: "13px",
  },
  preview: {
    width: "100%",
    borderRadius: "6px",
    marginTop: "8px",
    maxHeight: "150px",
    objectFit: "cover" as const,
  },
  generateBtn: {
    width: "100%",
    padding: "10px",
    marginTop: "10px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #5c5ccc, #4ecdc4)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
  status: {
    marginTop: "10px",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  spinner: {
    display: "inline-block",
    width: "12px",
    height: "12px",
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "#4ecdc4",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
