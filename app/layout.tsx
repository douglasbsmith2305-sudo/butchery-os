import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "George's Butchery OS — Trace every kilogram",
  description: "George's Butchery stock, cooler, accounts and point-of-sale operating system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
