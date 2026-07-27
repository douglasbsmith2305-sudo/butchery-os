import { AppShell } from "@/components/app-shell";
import { ScreenRouter } from "@/components/screens";

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <AppShell><ScreenRouter path={`/${slug.join("/")}`} /></AppShell>;
}
