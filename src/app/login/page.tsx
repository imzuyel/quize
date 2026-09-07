import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const HOME: Record<string, string> = {
  super_admin: "/admin",
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME[user.role] ?? "/student");
  const demoMode = process.env.DEMO_MODE !== "false";

  return (
    <div className="pg-hero-bg grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-4 flex items-center justify-center gap-2 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--pg-teal)] font-black">
            PG
          </span>
          <span className="font-extrabold">পিজিটিএসসি কুইজ অ্যারেনা</span>
        </Link>
        <LoginForm demoMode={demoMode} />
        <p className="mt-4 text-center text-xs text-white/60">
          পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ
        </p>
      </div>
    </div>
  );
}
