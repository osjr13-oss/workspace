export function removeEmDashes(value: string) {
  return value.replace(/\u2014/g, ",").replace(/\u2013/g, "-");
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
