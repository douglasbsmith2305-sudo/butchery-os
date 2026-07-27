import { AppShell } from "@/components/app-shell";
import { ScreenRouter } from "@/components/screens";

export default function HomePage() {
  return <AppShell><ScreenRouter path="/" /></AppShell>;
}
