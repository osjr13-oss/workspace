import {
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  FolderOpen,
  Globe2,
  ImageIcon,
  Layers,
  ListChecks,
  NotebookPen,
  Paperclip,
  RotateCcw,
  Wand2
} from "lucide-react";

/* Small, static pictures of real Selrano surfaces used on the landing page.
   Decorative: every caller pairs them with text that says the same thing. */

function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-tight)] ${className}`}>
      {children}
    </div>
  );
}

function Cite({ n, active = false }: { n: number; active?: boolean }) {
  return (
    <span
      className={`mx-0.5 inline-flex h-[16px] min-w-[16px] -translate-y-[2px] items-center justify-center rounded-[5px] border px-1 align-middle text-[10px] font-semibold leading-none ${
        active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]" : "border-[var(--accent-ring)] bg-[var(--accent-soft)] text-[var(--accent)]"
      }`}
    >
      {n}
    </span>
  );
}

export function GatherVignette() {
  const rows = [
    { icon: <FileText size={15} />, name: "Lecture 4, Enzymes.pdf", status: "Ready" },
    { icon: <FileText size={15} />, name: "Lab report draft.docx", status: "Ready" },
    { icon: <ImageIcon size={15} />, name: "Whiteboard photo.jpg", status: "Text read" }
  ];
  return (
    <Frame>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-2.5 rounded-[10px] bg-[var(--background-elevated)] px-3 py-2">
            <span className="text-[var(--muted)]">{row.icon}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{row.name}</span>
            <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--low)]">
              <Check size={12} strokeWidth={2.5} />
              {row.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 rounded-[10px] border border-dashed border-[var(--border-strong)] px-3 py-3 text-center text-[12.5px] text-[var(--muted)]">
        Drop files into a project
      </div>
    </Frame>
  );
}

export function AskVignette() {
  return (
    <Frame>
      <div className="flex justify-end">
        <div className="user-bubble max-w-[92%] text-[13px] leading-[1.55]">What does my lab report still need?</div>
      </div>
      <p className="mt-3 text-[13px] leading-[1.65] text-[var(--text)]">
        The methods are complete, but the discussion never links your results back to the{" "}
        <span className="whitespace-nowrap">
          hypothesis<Cite n={1} />.
        </span>{" "}
        The handout also asks for an error{" "}
        <span className="whitespace-nowrap">
          analysis<Cite n={2} />.
        </span>
      </p>
      <div className="composer mt-3 flex items-center gap-2 px-2.5 py-2 shadow-none">
        <Paperclip size={14} className="text-[var(--muted)]" />
        <span className="project-chip project-chip-select min-h-[26px] px-2 text-[12px]">
          <FolderOpen size={12} />
          Biology 201
        </span>
        <span className="flex-1" />
        <span className="send-button h-7 w-7">
          <ArrowUp size={13} />
        </span>
      </div>
    </Frame>
  );
}

export function KeepVignette() {
  return (
    <Frame className="relative">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--background-elevated)] p-3">
        <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
          <NotebookPen size={12} /> Note
        </p>
        <p className="mt-1.5 font-display text-[17px] leading-tight">Enzyme saturation</p>
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-[var(--surface-subtle)]" />
          <div className="h-1.5 w-4/5 rounded-full bg-[var(--surface-subtle)]" />
        </div>
      </div>
      <div className="-mt-1 ml-6 mr-[-6px] translate-y-2 rotate-[1.5deg] rounded-[12px] border border-[var(--border)] bg-[var(--surface-strong)] p-3 shadow-[var(--shadow-tight)]">
        <p className="flex items-center justify-between text-[11.5px] text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <Layers size={12} className="text-[var(--accent)]" /> Card 3 of 12
          </span>
          <RotateCcw size={12} />
        </p>
        <p className="mt-1.5 text-[13.5px] font-medium">What happens to the rate once an enzyme is saturated?</p>
      </div>
      <div className="h-3" />
    </Frame>
  );
}

export function CitationVignette() {
  return (
    <Frame className="p-5">
      <p className="text-[14px] leading-[1.75] text-[var(--text)]">
        Competitive inhibitors raise the apparent Km but leave Vmax unchanged, because enough substrate can still outcompete{" "}
        <span className="whitespace-nowrap">
          them<Cite n={1} active />.
        </span>
      </p>
      <div className="relative mt-4 rounded-[14px] border border-[var(--accent-ring)] bg-[var(--background-elevated)] p-4 shadow-[var(--shadow-soft)]">
        <span className="absolute -top-[7px] left-[62%] h-3 w-3 rotate-45 border-l border-t border-[var(--accent-ring)] bg-[var(--background-elevated)]" />
        <div className="flex items-center justify-between gap-3 text-[12.5px]">
          <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--muted-strong)]">
            <FileText size={14} className="text-[var(--accent)]" />
            <span className="truncate">Lecture 5, Inhibition.pdf</span>
          </span>
          <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">p. 7</span>
        </div>
        <p className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-strong)]">
          <span className="rounded-[3px] bg-[var(--highlight)] px-0.5 text-[var(--text)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            A competitive inhibitor increases Km without changing Vmax
          </span>{" "}
          since high substrate concentrations can still displace it.
        </p>
        <p className="mt-3 text-[12.5px] font-medium text-[var(--accent)]">Open at this passage</p>
      </div>
    </Frame>
  );
}

export function WebVignette() {
  const sources = [
    { title: "Course schedule, spring term", host: "Your university site" },
    { title: "Enzyme kinetics, a review", host: "Journal article, 2026" },
    { title: "Michaelis-Menten explained", host: "Encyclopedia entry" }
  ];
  return (
    <Frame className="p-5">
      <div className="tool-status text-[13px]">
        <Globe2 size={15} className="text-[var(--accent)]" />
        Searched the web
      </div>
      <p className="mt-3 text-[14px] leading-[1.75] text-[var(--text)]">
        The final exam moved to{" "}
        <span className="whitespace-nowrap">
          May 14<Cite n={1} />,
        </span>{" "}
        and the newest review agrees with your lecture on{" "}
        <span className="whitespace-nowrap">
          saturation<Cite n={2} />.
        </span>
      </p>
      <div className="mt-4 grid gap-2">
        {sources.map((source, index) => (
          <div key={source.title} className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{source.title}</span>
              <span className="block text-[11.5px] text-[var(--muted)]">{source.host}</span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function TransformVignette() {
  const actions = [
    { icon: <BookOpen size={13} />, label: "Summarize" },
    { icon: <NotebookPen size={13} />, label: "Make notes" },
    { icon: <Layers size={13} />, label: "Make a deck", active: true },
    { icon: <ListChecks size={13} />, label: "Quiz me" }
  ];
  return (
    <Frame className="p-5">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
        <FileText size={14} />
        Lecture 4, Enzymes.pdf
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <span
            key={action.label}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${
              action.active
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                : "border-[var(--border)] bg-[var(--background-elevated)] text-[var(--muted-strong)]"
            }`}
          >
            {action.icon}
            {action.label}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-strong)] p-3">
          <p className="text-[11.5px] text-[var(--muted)]">Front</p>
          <p className="mt-1 text-[13px] font-medium leading-snug">What does Km tell you about an enzyme?</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--background-elevated)] p-3">
          <p className="text-[11.5px] text-[var(--muted)]">Back</p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--muted-strong)]">How much substrate it needs to reach half its top speed.</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px] text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <Wand2 size={12} className="text-[var(--accent)]" /> Review today
          </span>
          <span>8 of 12</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
          <div className="h-full w-2/3 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    </Frame>
  );
}

export function StyleVignette() {
  return (
    <Frame className="p-5">
      <div className="flex justify-end">
        <div className="user-bubble max-w-[85%] text-[13px] leading-[1.55]">Shorter, please. Bullets first, then one line of why.</div>
      </div>
      <p className="mt-4 text-[11.5px] text-[var(--muted)]">A week later, in a new chat</p>
      <div className="mt-2 rounded-[12px] border border-[var(--border)] bg-[var(--background-elevated)] p-3.5">
        <ul className="list-disc space-y-1 pl-4 text-[13px] leading-[1.6] text-[var(--text)] marker:text-[var(--muted)]">
          <li>Glycolysis happens in the cytoplasm</li>
          <li>Net gain: 2 ATP, 2 NADH</li>
          <li>No oxygen needed</li>
        </ul>
        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--muted-strong)]">Why it matters: it is the first step whether or not oxygen is around.</p>
      </div>
    </Frame>
  );
}
