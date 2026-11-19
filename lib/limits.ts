/** Fixed limits for the private workspace (there are no plans or tiers). */
export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function assertUploadSize(size: number) {
  return size > MAX_UPLOAD_BYTES ? `Files can be up to ${MAX_UPLOAD_MB} MB.` : null;
}
