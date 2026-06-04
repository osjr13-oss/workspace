import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Selrano",
  description: "A premium AI workspace for organizing study, writing, and research."
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
