import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { PwaProvider } from "@/components/pwa-provider";
import { brand, absoluteUrl } from "@/lib/brand";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: brand.colors.background,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`
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
  },
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: "default"
  },
  applicationName: brand.name,
  // Private while the owner builds it (lib/access.ts).
  robots: { index: false, follow: false },
  formatDetection: {
    telephone: false
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaProvider />
        <Analytics />
      </body>
    </html>
  );
}
