import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Butchery OS — Trace every kilogram",
  description: "Inventory, processing and traceability operating system for modern retail butcheries.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
