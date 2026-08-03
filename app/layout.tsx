import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
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
  formatDetection: {
    telephone: false
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${brand.urls.app}/#website`,
        "url": brand.urls.app,
        "name": brand.name,
        "description": brand.tagline
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${brand.urls.app}/#application`,
        "name": brand.name,
        "operatingSystem": "All",
        "applicationCategory": "ProductivityApplication",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "description": "An adaptive personal AI workspace for project materials, notes, private file uploads, grounded chat, and study review."
      }
    ]
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <PwaProvider />
        <Analytics />
      </body>
    </html>
  );
}
