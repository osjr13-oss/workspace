import Link from "next/link";

export function Landing() {
  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <p className="font-serif text-lg tracking-tight">Selrano</p>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/signin" className="text-[var(--muted)] hover:text-[var(--ink)]">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-white">
            Open a chat
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-20 pt-16 sm:pt-24">
        <h1 className="max-w-xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          Think in a conversation.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
          A quiet chat. It can search the web, read a file you attach, and save a note or a set of flashcards when you ask. The header shows the Groq model that is answering.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup" className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-white">
            Start a chat
          </Link>
          <Link href="/signin" className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-sm">
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-3xl gap-8 px-5 pb-24 sm:grid-cols-3">
        <div>
          <h2 className="text-sm font-medium">Saved threads</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Signed-in chats stay on your account. There is no second home.</p>
        </div>
        <div>
          <h2 className="text-sm font-medium">Search and files</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Web search uses Tavily. If the key is missing, the reply says search is off.</p>
        </div>
        <div>
          <h2 className="text-sm font-medium">Notes and cards</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Ask for a note or flashcards. Open them from the message, or from the account menu.</p>
        </div>
      </section>
    </main>
  );
}
