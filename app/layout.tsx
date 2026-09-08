import type { Metadata, Viewport } from "next";


import { brand, absoluteUrl } from "@/lib/brand";
import "./globals.css";

// Request-specific CSP nonces require server rendering for every document.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: brand.colors.background,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: {
    default: "Selrano 1 | Preview",
    template: `%s | ${brand.name}`
  },
  description: "A thinking partner for exploring ideas and making decisions.",
  metadataBase: new URL(brand.urls.app),
  openGraph: {
    title: brand.name,
    description: "A thinking partner for exploring ideas and making decisions.",
    url: brand.urls.app,
    siteName: brand.name,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: "A thinking partner for exploring ideas and making decisions."
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


      </body>
    </html>
  );
}
