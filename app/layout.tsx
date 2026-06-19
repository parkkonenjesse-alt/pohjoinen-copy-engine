import type { Metadata } from "next";
import "./globals.css";

// Fonts are self-hosted ABC Diatype (Medium/Bold) + ABC Diatype Mono,
// declared via @font-face in globals.css to match Wolverine Worldwide exactly.

export const metadata: Metadata = {
  title: "Pohjoinen · Catalog Copy Engine",
  description:
    "Turn a few product specs into SEO-ready, multilingual store copy. Powered by Claude.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
