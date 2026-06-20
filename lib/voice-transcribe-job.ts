import { recordUsage } from "@/lib/ai-usage";
import { transcribeAudio } from "@/lib/groq-whisper";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function processVoiceTranscription(params: {
  sessionId: string;
  userId: string;
  storagePath: string;
  mimeType: string;
}) {
  const admin = createSupabaseAdminClient();

  try {
    const { data: file, error: downloadError } = await admin.storage.from("workspace-files").download(params.storagePath);
    if (downloadError || !file) throw downloadError || new Error("Could not download audio file");

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = params.mimeType.includes("mp4") ? "mp4" : params.mimeType.includes("mpeg") ? "mp3" : "webm";
    const transcription = await transcribeAudio(buffer, params.mimeType, `recording.${extension}`);

    const { error: updateError } = await admin
      .from("voice_sessions")
      .update({
        status: "transcribed",
        raw_transcription: transcription,
        error_message: null
      })
      .eq("id", params.sessionId)
      .eq("user_id", params.userId);

    if (updateError) throw updateError;

    await recordUsage(admin, params.userId, "transcribe", {
      model: process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo",
      input_chars: transcription.length
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[voice-transcribe-job]", params.sessionId, message, error);
    await admin
      .from("voice_sessions")
      .update({ status: "failed", error_message: message })
      .eq("id", params.sessionId)
      .eq("user_id", params.userId);
  }
}
