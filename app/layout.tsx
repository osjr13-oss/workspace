import type { Metadata } from "next";
import { brand, absoluteUrl } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s — ${brand.name}`
  },
  description: brand.tagline,
  metadataBase: new URL(brand.urls.app),
  openGraph: {
    title: brand.name,
    description: brand.tagline,
    url: brand.urls.app,
    siteName: brand.name,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: brand.tagline
  },
  alternates: {
    canonical: absoluteUrl("/")
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
