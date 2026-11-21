"use client";

import { Upload as TusUpload } from "tus-js-client";
import type { WorkspaceFile } from "@/lib/types";

export const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp,.gif";

/**
 * Uploads a file into the workspace: a signed resumable upload straight to
 * Supabase Storage, then server-side text extraction. Returns the saved file.
 */
export async function uploadWorkspaceFile(
  file: File,
  options: { projectId: string | null; onProgress?: (percent: number) => void; onProcessing?: () => void }
): Promise<WorkspaceFile> {
  const metadata = {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    projectId: options.projectId || null
  };
  const signResponse = await fetch("/api/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata)
  });
  const signed = await signResponse.json().catch(() => ({}));
  if (!signResponse.ok || !signed.storagePath || !signed.token) {
    throw new Error(signed.error || "Could not prepare the upload.");
  }

  await uploadFileResumable(file, signed.storagePath, signed.token, options.onProgress || (() => undefined));
  options.onProcessing?.();

  const response = await fetch("/api/files/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...metadata, storagePath: signed.storagePath })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.file) throw new Error(payload.error || "File processing failed.");
  return payload.file as WorkspaceFile;
}

function uploadFileResumable(file: File, storagePath: string, token: string, onProgress: (progress: number) => void) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return Promise.reject(new Error("Storage is not configured."));
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

  return new Promise<void>((resolve, reject) => {
    // Each /api/files/upload-url call returns a fresh storage path and one-time
    // signed token, so never resume a stale URL saved in browser storage.
    const upload = new TusUpload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable/sign`,
      headers: { "x-signature": token },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 2000, 5000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      metadata: {
        bucketName: "workspace-files",
        objectName: storagePath,
        contentType: file.type || "application/octet-stream"
      },
      onError(error) {
        reject(error);
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        resolve();
      }
    });

    upload.start();
  });
}
