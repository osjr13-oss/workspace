import { Suspense } from "react";
import { ChatApp } from "@/components/chat-app";
import { allowedModels, configuredDefaultModel } from "@/lib/models";

export const dynamic = "force-dynamic";

export default function ChatsPage() {
  const models = allowedModels();
  const preferred = configuredDefaultModel();
  const defaultModel = models.includes(preferred) ? preferred : models[0];
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center text-sm text-[var(--muted)]">Loading chat</div>}>
      <ChatApp models={models} defaultModel={defaultModel} />
    </Suspense>
  );
}
