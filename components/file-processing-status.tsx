import { CheckCircle2, CircleSlash2, LoaderCircle, TriangleAlert } from "lucide-react";
import type { WorkspaceFile } from "@/lib/types";

type FileProcessingStatusProps = {
  status: WorkspaceFile["extraction_status"];
};

const statusConfig = {
  ready: {
    label: "Searchable",
    Icon: CheckCircle2,
    badgeClass: "badge-success"
  },
  pending: {
    label: "Processing",
    Icon: LoaderCircle,
    badgeClass: "badge-warning"
  },
  unsupported: {
    label: "Unsupported",
    Icon: CircleSlash2,
    badgeClass: "badge"
  },
  failed: {
    label: "Failed",
    Icon: TriangleAlert,
    badgeClass: "badge-critical"
  }
} as const;

export function FileProcessingStatus({ status }: FileProcessingStatusProps) {
  const { label, Icon, badgeClass } = statusConfig[status] || statusConfig.unsupported;

  return (
    <span className={`badge ${badgeClass} text-xs`}>
      <Icon
        size={13}
        className={status === "pending" ? "animate-spin" : ""}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
