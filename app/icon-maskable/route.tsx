import { ImageResponse } from "next/og";
import { PwaIconMarkup } from "@/lib/pwa-icon-markup";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<PwaIconMarkup size={512} maskable />, {
    width: 512,
    height: 512
  });
}
