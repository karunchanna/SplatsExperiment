const API_BASE = "/api";

export interface PrepareUploadResponse {
  media_asset: {
    media_asset_id: string;
  };
  upload_info: {
    upload_url: string;
    required_headers: Record<string, string>;
  };
}

export interface GenerateWorldResponse {
  operation_id: string;
}

export interface OperationResponse {
  done: boolean;
  response?: {
    world_id: string;
    display_name: string;
    assets?: {
      splats?: {
        spz_urls?: {
          "500k"?: string;
          full_res?: string;
          "100k"?: string;
        };
      };
      mesh?: {
        collider_mesh_url?: string;
      };
      imagery?: {
        pano_url?: string;
        thumbnail_url?: string;
      };
    };
    world_marble_url?: string;
  };
  error?: {
    message: string;
  };
}

function headers(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
}

export async function prepareUpload(
  apiKey: string,
  fileName: string,
  extension: string
): Promise<PrepareUploadResponse> {
  const res = await fetch(`${API_BASE}/prepare-upload`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ fileName, extension }),
  });
  if (!res.ok) throw new Error(`Prepare upload failed: ${res.statusText}`);
  return res.json();
}

export async function uploadFile(
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string>
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      ...requiredHeaders,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) throw new Error(`File upload failed: ${res.statusText}`);
}

export async function generateWorld(
  apiKey: string,
  opts: {
    mediaAssetId?: string;
    imageUri?: string;
    textPrompt?: string;
  }
): Promise<GenerateWorldResponse> {
  const res = await fetch(`${API_BASE}/generate-world`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`Generate world failed: ${res.statusText}`);
  return res.json();
}

export async function pollOperation(
  apiKey: string,
  operationId: string
): Promise<OperationResponse> {
  const res = await fetch(`${API_BASE}/operations/${operationId}`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`Poll failed: ${res.statusText}`);
  return res.json();
}

export async function pollUntilDone(
  apiKey: string,
  operationId: string,
  onProgress?: (status: string) => void
): Promise<OperationResponse> {
  const INTERVAL = 5000;
  const MAX_ATTEMPTS = 120; // 10 minutes max

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const result = await pollOperation(apiKey, operationId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (result.done) {
      return result;
    }

    onProgress?.(`Generating world... (${i * 5}s elapsed)`);
    await new Promise((r) => setTimeout(r, INTERVAL));
  }

  throw new Error("World generation timed out");
}

export function getSplatUrl(
  operation: OperationResponse,
  resolution: "100k" | "500k" | "full_res" = "500k"
): string | null {
  const urls = operation.response?.assets?.splats?.spz_urls;
  if (!urls) return null;
  return urls[resolution] ?? urls["500k"] ?? urls["100k"] ?? null;
}
