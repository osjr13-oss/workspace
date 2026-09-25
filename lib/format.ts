export function formatRelative(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
