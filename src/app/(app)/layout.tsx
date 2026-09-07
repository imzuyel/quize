import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    // Session cookie present but expired/invalid — re-enter demo on the same page.
    const path = (await headers()).get("x-pathname") ?? "";
    const demoMode = process.env.DEMO_MODE !== "false";
    if (!demoMode) redirect("/login");
    redirect(path ? `/demo?next=${encodeURIComponent(path)}` : "/demo");
  }
  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        role: user.role,
        xp: user.xp,
        level: user.level,
        locale: user.locale,
      }}
    >
      {children}
    </AppShell>
  );
}
