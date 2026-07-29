import type { Metadata } from "next";
import { OperationsProvider } from "@/components/operations-store";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ill-wine.vercel.app"),
  title: "George's Butchery OS — Trace every kilogram",
  description: "The operating system for George's Butchery: stock, processing, POS, purchasing and traceability.",
  openGraph: {
    title: "George's Butchery OS",
    description: "Stock, processing, POS, purchasing and traceability in one operating system.",
    images: [{ url: "/og-georges-butchery.png", width: 1731, height: 909, alt: "George's Butchery — Est 2010" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "George's Butchery OS",
    description: "Stock, processing, POS, purchasing and traceability in one operating system.",
    images: ["/og-georges-butchery.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><OperationsProvider>{children}</OperationsProvider></body>
    </html>
  );
}
