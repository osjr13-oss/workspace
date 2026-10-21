import { CheckCircle2, CircleSlash2, LoaderCircle, TriangleAlert } from "lucide-react";
import type { WorkspaceFile } from "@/lib/types";

type FileProcessingStatusProps = {
  status: WorkspaceFile["extraction_status"];
};

const statusConfig = {
  ready: {
    label: "Searchable",
    Icon: CheckCircle2,
    className: "text-[var(--low)]"
  },
  pending: {
    label: "Processing",
    Icon: LoaderCircle,
    className: "text-[var(--medium)]"
  },
  unsupported: {
    label: "Unsupported",
    Icon: CircleSlash2,
    className: "text-[var(--muted)]"
  },
  failed: {
    label: "Needs attention",
    Icon: TriangleAlert,
    className: "text-[var(--critical)]"
  }
} as const;

export function FileProcessingStatus({ status }: FileProcessingStatusProps) {
  const { label, Icon, className } = statusConfig[status];

  return (
    <span className={`inline-flex items-center gap-2 text-xs font-extrabold tracking-[-0.01em] ${className}`}>
      <Icon size={15} strokeWidth={2.25} className={status === "pending" ? "animate-spin" : ""} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
