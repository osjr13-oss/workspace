import {
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  FolderOpen,
  Globe2,
  ImageIcon,
  ListChecks,
  Mail,
  NotebookPen,
  Paperclip
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
    { icon: <FileText size={15} />, name: "Lease agreement.pdf", status: "Ready" },
    { icon: <FileText size={15} />, name: "Cover letter draft.docx", status: "Ready" },
    { icon: <ImageIcon size={15} />, name: "Receipt photo.jpg", status: "Text read" }
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
        <div className="user-bubble max-w-[92%] text-[13px] leading-[1.55]">What does my cover letter still need?</div>
      </div>
      <p className="mt-3 text-[13px] leading-[1.65] text-[var(--text)]">
        Your experience section is strong, but the letter never names the team from the{" "}
        <span className="whitespace-nowrap">
          posting<Cite n={1} />.
        </span>{" "}
        The posting also asks you to mention your start{" "}
        <span className="whitespace-nowrap">
          date<Cite n={2} />.
        </span>
      </p>
      <div className="composer mt-3 flex items-center gap-2 px-2.5 py-2 shadow-none">
        <Paperclip size={14} className="text-[var(--muted)]" />
        <span className="project-chip project-chip-select min-h-[26px] px-2 text-[12px]">
          <FolderOpen size={12} />
          Job search
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
        <p className="mt-1.5 font-display text-[17px] leading-tight">Moving out early</p>
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-[var(--surface-subtle)]" />
          <div className="h-1.5 w-4/5 rounded-full bg-[var(--surface-subtle)]" />
        </div>
      </div>
      <div className="-mt-1 ml-6 mr-[-6px] translate-y-2 rotate-[1.5deg] rounded-[12px] border border-[var(--border)] bg-[var(--surface-strong)] p-3 shadow-[var(--shadow-tight)]">
        <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
          <ListChecks size={12} className="text-[var(--accent)]" /> Checklist
        </p>
        <p className="mt-1.5 text-[13.5px] font-medium">Email the 60 day notice and keep a copy.</p>
      </div>
      <div className="h-3" />
    </Frame>
  );
}

export function CitationVignette() {
  return (
    <Frame className="p-5">
      <p className="text-[14px] leading-[1.75] text-[var(--text)]">
        Your plan covers the replacement cost of a stolen laptop, minus the $500 deductible, as long as you file within{" "}
        <span className="whitespace-nowrap">
          30 days<Cite n={1} active />.
        </span>
      </p>
      <div className="relative mt-4 rounded-[14px] border border-[var(--accent-ring)] bg-[var(--background-elevated)] p-4 shadow-[var(--shadow-soft)]">
        <span className="absolute -top-[7px] left-[62%] h-3 w-3 rotate-45 border-l border-t border-[var(--accent-ring)] bg-[var(--background-elevated)]" />
        <div className="flex items-center justify-between gap-3 text-[12.5px]">
          <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--muted-strong)]">
            <FileText size={14} className="text-[var(--accent)]" />
            <span className="truncate">Renters insurance.pdf</span>
          </span>
          <span className="shrink-0 text-[12px] text-[var(--muted)]">Page 3</span>
        </div>
        <p className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-strong)]">
          <span className="rounded-[3px] bg-[var(--highlight)] px-0.5 text-[var(--text)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            Personal property is covered at replacement cost, less the deductible,
          </span>{" "}
          when a claim is filed within 30 days of the loss.
        </p>
        <p className="mt-3 text-[12.5px] font-medium text-[var(--accent)]">Open at this passage</p>
      </div>
    </Frame>
  );
}

export function WebVignette() {
  const sources = [
    { title: "Holiday hours and returns", host: "Store help page" },
    { title: "Price tracker, laptops", host: "Retail listing, this week" },
    { title: "Laptop buying guide", host: "Consumer review site" }
  ];
  return (
    <Frame className="p-5">
      <div className="tool-status text-[13px]">
        <Globe2 size={15} className="text-[var(--accent)]" />
        Searched the web
      </div>
      <p className="mt-3 text-[14px] leading-[1.75] text-[var(--text)]">
        Returns are open until{" "}
        <span className="whitespace-nowrap">
          January 15<Cite n={1} />,
        </span>{" "}
        and the model you saved dropped $120 this{" "}
        <span className="whitespace-nowrap">
          week<Cite n={2} />.
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
    { icon: <Mail size={13} />, label: "Draft a reply", active: true },
    { icon: <ListChecks size={13} />, label: "Make a checklist" }
  ];
  return (
    <Frame className="p-5">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
        <FileText size={14} />
        Landlord email.pdf
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <span
            key={action.label}
            className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-medium ${
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
      <div className="mt-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface-strong)] p-3">
        <p className="text-[11.5px] text-[var(--muted)]">Draft</p>
        <p className="mt-1 text-[13px] leading-[1.6] text-[var(--text)]">
          Thanks for confirming the carpet charge is waived. I will send my 60 day notice by Friday and can schedule the inspection any
          weekday after the 20th.
        </p>
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
          <li>Book the flight on Tuesday</li>
          <li>Carry-on only fits the cheaper fare</li>
          <li>Window seats are still open</li>
        </ul>
        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--muted-strong)]">Why: Tuesday fares are $60 lower for your dates.</p>
      </div>
    </Frame>
  );
}
