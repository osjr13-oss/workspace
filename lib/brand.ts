export function absoluteUrl(path: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const base = configured || "http://localhost:3000";
  return new URL(path, `${base}/`).toString();
}

export function emailFrom() {
  return process.env.EMAIL_FROM?.trim() || "Selrano <noreply@selrano.com>";
}
