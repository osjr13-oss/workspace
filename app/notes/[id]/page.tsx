import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MarkdownView } from "@/components/markdown-view";
import { supabaseConfigured } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params;
  if (!supabaseConfigured()) {
    return <main className="p-8 text-sm">Sign in is not configured.</main>;
  }
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect(`/signin?next=/notes/${id}`);
  const { data, error } = await supabase.from("notes").select("id, title, content, thread_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-[var(--bg)] px-5 py-10">
      <Link href={data.thread_id ? `/chats?thread=${data.thread_id}` : "/chats"} className="text-sm text-[var(--muted)]">
        Back to chat
      </Link>
      <h1 className="mt-6 font-serif text-4xl tracking-tight">{data.title}</h1>
      <div className="mt-6">
        {data.content?.trim() ? <MarkdownView text={data.content} /> : <p className="text-sm text-[var(--muted)]">This note is empty.</p>}
      </div>
    </main>
  );
}
