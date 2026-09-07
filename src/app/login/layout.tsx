import type { ReactNode } from "react";

export const metadata = {
  title: "লগইন",
  description: "শিক্ষক, শিক্ষার্থী ও অভিভাবকের জন্য পিজিটিএসসি কুইজ অ্যারেনায় প্রবেশ।",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
