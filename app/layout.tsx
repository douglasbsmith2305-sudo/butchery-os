import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Butchery OS — Automatic kilogram control",
  description: "Automatic meat yield allocation from supplier scale weight to cooler inventory.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
