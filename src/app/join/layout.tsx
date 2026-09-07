import type { ReactNode } from "react";

export const metadata = {
  title: "কুইজে যোগ দিন",
  description: "গেম পিন দিয়ে সরাসরি লাইভ কুইজে যোগ দিন — অ্যাকাউন্ট ছাড়াই।",
  alternates: { canonical: "/join" },
};

export default function JoinLayout({ children }: { children: ReactNode }) {
  return children;
}
