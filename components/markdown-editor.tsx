"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Heading2, List, Quote } from "lucide-react";

const snippets = [
  { label: "Heading", icon: Heading2, value: "\n## Heading\n" },
  { label: "Bold", icon: Bold, value: "**important text**" },
  { label: "List", icon: List, value: "\n- First point\n- Second point\n" },
  { label: "Quote", icon: Quote, value: "\n> Key idea\n" }
];

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write in markdown..."
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] p-3">
          {snippets.map((snippet) => {
            const Icon = snippet.icon;
            return (
              <button
                key={snippet.label}
                type="button"
                title={snippet.label}
                onClick={() => onChange(`${value}${snippet.value}`)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-white/70 text-[var(--muted-strong)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              >
                <Icon size={17} />
              </button>
            );
          })}
        </div>
        <textarea
          aria-label="Markdown note content"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[520px] w-full resize-y bg-transparent p-5 text-sm leading-7 text-[var(--text)] outline-none"
        />
      </div>
      <div className="panel min-h-[520px] p-5">
        <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Preview</p>
        <ReactMarkdown className="prose-Selrano" remarkPlugins={[remarkGfm]}>
          {value || "Start writing to preview your note."}
        </ReactMarkdown>
      </div>
    </div>
  );
}
