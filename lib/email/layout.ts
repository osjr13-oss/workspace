import { absoluteUrl, brand } from "@/lib/brand";

export function emailLayout(content: string, preview: string, options?: { showUnsubscribe?: boolean }) {
  const unsubscribe = options?.showUnsubscribe
    ? `<br /><a href="${absoluteUrl("/settings")}" style="color:${brand.colors.muted};">Email preferences</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${brand.name}</title>
</head>
<body style="margin:0;padding:0;background:${brand.colors.background};font-family:'Segoe UI',system-ui,sans-serif;color:${brand.colors.text};">
  <div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.colors.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffefa;border:1px solid rgba(31,35,44,0.1);border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;font-size:22px;font-weight:800;letter-spacing:-0.03em;">${brand.name}</td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:${brand.colors.muted};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(31,35,44,0.1);font-size:12px;line-height:1.5;color:${brand.colors.muted};">
              © ${new Date().getFullYear()} ${brand.legalName}. All rights reserved.<br />
              <a href="${absoluteUrl(brand.urls.privacy)}" style="color:${brand.colors.text};">Privacy</a>
              · <a href="${absoluteUrl(brand.urls.terms)}" style="color:${brand.colors.text};">Terms</a>${unsubscribe}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function cta(href: string, label: string) {
  return `<a href="${absoluteUrl(href)}" style="display:inline-block;background:${brand.colors.accent};color:#fffefa;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px;">${label}</a>`;
}
