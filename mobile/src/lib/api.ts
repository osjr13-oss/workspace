import { fetch as streamingFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { readChatStream, type ChatStreamEvent } from "@shared/chat-stream";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/** Raised when the website refuses the account (not on the private allowlist, or signed out). */
export class NoAccessError extends Error {}

async function token() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new NoAccessError("Signed out.");
  return accessToken;
}

/** Calls the Selrano website API as the signed-in user. */
export async function api<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) throw new NoAccessError(payload.error || "No access.");
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload as T;
}

/** Confirms the signed-in account is on Selrano's private allowlist. */
export async function checkAccess() {
  const response = await fetch(`${config.apiUrl}/api/me`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (response.status === 401) throw new NoAccessError("This account does not have access to Selrano.");
  if (!response.ok) throw new Error(`Could not reach Selrano (${response.status}).`);
}

export type ChatRequest = {
  message?: string;
  threadId?: string | null;
  projectId?: string | null;
  editMessageId?: string;
  regenerateMessageId?: string;
  fileIds?: string[];
};

/**
 * Sends a chat message and reads the reply stream (see lib/chat-stream.ts).
 * Errors before the reply starts (sign in, limits) are thrown with the website's message.
 */
export async function streamChat(request: ChatRequest, onEvent: (event: ChatStreamEvent) => void, signal: AbortSignal) {
  const response = await streamingFetch(`${config.apiUrl}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(request),
    signal
  });
  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 401) throw new NoAccessError(payload.error || "No access.");
    throw new Error(payload.error || "Chat failed.");
  }
  await readChatStream(response.body as ReadableStream<Uint8Array>, onEvent);
}

/** Stop: saves exactly the words already shown as the reply. */
export function stopReply(threadId: string, content: string) {
  return api<{ saved: boolean }>("/api/ai/chat/stop", { threadId, content });
}

export type PickedFile = { uri: string; name: string; mimeType: string; size?: number | null };

/** Uploads a picked photo or document into the workspace and returns the saved file's id. */
export async function uploadFile(file: PickedFile, projectId: string | null): Promise<string> {
  const local = new File(file.uri);
  const size = file.size || local.size || 0;
  const signed = await api<{ storagePath: string; token: string }>("/api/files/upload-url", {
    name: file.name,
    type: file.mimeType,
    size,
    projectId
  });
  const bytes = await local.arrayBuffer();
  const { error } = await supabase.storage
    .from("workspace-files")
    .uploadToSignedUrl(signed.storagePath, signed.token, bytes, { contentType: file.mimeType });
  if (error) throw new Error(error.message || "Upload failed.");
  const processed = await api<{ file: { id: string } }>("/api/files/upload", {
    name: file.name,
    type: file.mimeType,
    size,
    projectId,
    storagePath: signed.storagePath
  });
  return processed.file.id;
}
