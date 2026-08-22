"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Heading2, Italic, List, Quote } from "lucide-react";

const snippets = [
  { label: "Heading", icon: Heading2, value: "\n## Heading\n" },
  { label: "Bold", icon: Bold, value: "**important text**" },
  { label: "Italic", icon: Italic, value: "_emphasis_" },
  { label: "List", icon: List, value: "\n* First item\n* Second item\n" },
  { label: "Quote", icon: Quote, value: "\n> Key takeaway\n" },
  { label: "Code", icon: Code, value: "\n```typescript\n// code here\n```\n" }
];

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write in markdown format..."
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Editor Pane */}
      <div className="panel flex flex-col overflow-hidden bg-white">
        <div className="flex items-center gap-1 border-b border-[var(--border)] bg-slate-50/70 p-2">
          {snippets.map((snippet) => {
            const Icon = snippet.icon;
            return (
              <button
                key={snippet.label}
                type="button"
                title={snippet.label}
                onClick={() => onChange(`${value}${snippet.value}`)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted)] transition hover:bg-slate-100 hover:text-[var(--text)]"
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        <textarea
          aria-label="Markdown note content"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[460px] flex-1 resize-y bg-transparent p-4 text-sm leading-relaxed text-[var(--text)] outline-none font-mono placeholder:text-[var(--muted)]"
        />
      </div>

      {/* Live Preview Pane */}
      <div className="panel flex flex-col overflow-hidden bg-white p-5">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Live Preview
          </span>
          <span className="badge badge-subtle text-[10px]">Formatted</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ReactMarkdown className="prose-selrano" remarkPlugins={[remarkGfm]}>
            {value || "_Start typing markdown on the left to see live preview._"}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
