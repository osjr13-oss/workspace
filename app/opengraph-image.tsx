import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Selrano: your notes, files, and the web, in one calm place to think.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Newsreader for the headline. Google serves TrueType when no browser user agent
// is sent, which is what the image renderer needs. Falls back to the default
// font if the download fails, so the build never breaks on it.
async function loadDisplayFont() {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Newsreader:wght@500")).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const [font, logo] = await Promise.all([
    loadDisplayFont(),
    readFile(join(process.cwd(), "public/logo.svg"), "utf8").catch(() => "")
  ]);
  const logoSrc = logo ? `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f6f3ec",
          color: "#16191f"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {logoSrc ? <img src={logoSrc} width={56} height={51} alt="" /> : null}
          <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em" }}>Selrano</span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontFamily: font ? "Newsreader" : undefined,
            fontSize: 78,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: 1000
          }}
        >
          Your notes, files, and the web, in one calm place to think.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#3b4048" }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: "#1b2d50" }} />
          An AI workspace that answers from your own material.
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Newsreader", data: font, weight: 500, style: "normal" }] : [] }
  );
}
