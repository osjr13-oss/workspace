import { Upload as TusUpload } from "tus-js-client";

export function uploadFileResumable(
  file: File,
  storagePath: string,
  token: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return Promise.reject(new Error("Storage is not configured."));
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

  return new Promise<void>((resolve, reject) => {
    const upload = new TusUpload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable/sign`,
      headers: { "x-signature": token },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "workspace-files",
        objectName: storagePath,
        contentType: file.type || "application/octet-stream"
      },
      onError(error) {
        reject(error);
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        resolve();
      }
    });

    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch(reject);
  });
}

export async function uploadWorkspaceFile(
  file: File,
  options?: { projectId?: string | null; onProgress?: (progress: number) => void }
): Promise<{ id: string; name: string; size: number }> {
  const metadata = {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    projectId: options?.projectId || null
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

  await uploadFileResumable(file, signed.storagePath, signed.token, options?.onProgress);

  const processResponse = await fetch("/api/files/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...metadata, storagePath: signed.storagePath })
  });
  const payload = await processResponse.json().catch(() => ({}));
  if (!processResponse.ok || !payload.file) {
    throw new Error(payload.error || "File processing failed.");
  }

  return {
    id: payload.file.id,
    name: payload.file.name,
    size: payload.file.size_bytes || file.size
  };
}
