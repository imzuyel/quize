/** Tiny local class joiner so this stays a dependency-free server component. */
function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Platform author — shown in the public footer and the in-app About page. */
export const AUTHOR = {
  name: "মোঃ জুয়েল রানা",
  nameEn: "Md. Juyel Rana",
  title: "জুনিয়র ইন্সট্রাক্টর (আইটি সাপোর্ট এন্ড আইওটি বেসিকস)",
  titleEn: "Junior Instructor (IT Support & IoT Basics)",
  institute: "পঞ্চগড় সরকারি টেকনিক্যাল স্কুল এন্ড কলেজ",
  instituteEn: "Panchagarh Government Technical School and College",
  links: [
    {
      key: "web" as const,
      label: "ওয়েবসাইট",
      href: "https://imzuyel.top",
      handle: "imzuyel.top",
      ring: "#12a08c",
    },
    {
      key: "facebook" as const,
      label: "ফেসবুক",
      href: "https://facebook.com/imzuyel",
      handle: "@imzuyel",
      ring: "#1877f2",
    },
    {
      key: "page" as const,
      label: "বনমালী পেজ",
      href: "https://facebook.com/bonomaly001",
      handle: "বনমালী",
      ring: "#22c55e",
    },
  ],
};

type IconKey = (typeof AUTHOR.links)[number]["key"];

function BrandIcon({ name, size = 20 }: { name: IconKey; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;

  if (name === "facebook")
    return (
      <svg {...common} fill="currentColor">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.470h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
      </svg>
    );

  if (name === "page")
    // Leaf mark for the "বনমালী" (grove/garden) page.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.5-6" />
      </svg>
    );

  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19" />
      <path d="M12 2.5c2.6 2.7 4 6 4 9.5s-1.4 6.8-4 9.5c-2.6-2.7-4-6-4-9.5s1.4-6.8 4-9.5Z" />
    </svg>
  );
}

/**
 * Icon-only social row with an animated ring.
 * Labels stay available to screen readers and as native tooltips.
 */
export function SocialRing({
  tone = "dark",
  size = 20,
  idle = true,
  className,
}: {
  tone?: "dark" | "light";
  size?: number;
  idle?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2.5", className)}>
      {AUTHOR.links.map((l, i) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer me"
          title={`${l.label} — ${l.handle}`}
          aria-label={`${l.label} (${l.handle}) — নতুন ট্যাবে খুলবে`}
          className={cx(
            "pg-social",
            idle && "pg-social-idle",
            tone === "dark" ? "text-white/85 hover:text-white" : "text-slate-600 hover:text-white",
          )}
          style={{ ["--ring" as string]: l.ring, ["--delay" as string]: `${i * 1.1}s` }}
        >
          <BrandIcon name={l.key} size={size} />
        </a>
      ))}
    </div>
  );
}

/** Compact one-line credit for footers/sidebars. */
export function CreditLine({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const muted = tone === "dark" ? "text-white/50" : "text-slate-500";
  const strong = tone === "dark" ? "text-white/80" : "text-slate-700";
  return (
    <div>
      <p className={`text-xs ${muted}`}>
        ডিজাইন ও ডেভেলপমেন্ট — <span className={`font-bold ${strong}`}>{AUTHOR.name}</span>
      </p>
      <SocialRing tone={tone} size={16} className="mt-2" />
    </div>
  );
}

/** Full developer card used on the landing page and the About page. */
export function DeveloperCard({ compact }: { compact?: boolean }) {
  return (
    <div className="pg-surface pg-shadow overflow-hidden">
      <div className="pg-hero-bg relative px-5 py-6 text-white">
        <div className="pg-grid-lines absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div
            className="pg-ring-orbit grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-black backdrop-blur"
            style={{ ["--ring" as string]: "#f0b429" }}
          >
            JR
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">ডেভেলপার</p>
            <h3 className="text-xl font-extrabold">{AUTHOR.name}</h3>
            <p className="text-sm text-white/80">{AUTHOR.title}</p>
            <p className="text-xs text-white/60">{AUTHOR.institute}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {AUTHOR.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer me"
              className="group flex items-center gap-3 rounded-xl border border-[var(--pg-line)] px-3 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5"
              style={{ ["--ring" as string]: l.ring }}
            >
              <span
                className="pg-social h-10 w-10 shrink-0 text-slate-600 group-hover:text-white"
                style={{ ["--ring" as string]: l.ring }}
              >
                <BrandIcon name={l.key} />
              </span>
              <span className="min-w-0">
                <span className="block leading-tight">{l.label}</span>
                <span className="block truncate text-[11px] font-normal text-slate-500">{l.handle}</span>
              </span>
            </a>
          ))}
        </div>
        {!compact ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            পিজিটিএসসি কুইজ অ্যারেনা — কারিগরি ও সাধারণ শিক্ষার জন্য একটি এআই-চালিত ইন্টারেক্টিভ
            লার্নিং প্ল্যাটফর্ম। যেকোনো প্রতিষ্ঠান এটি ব্যবহার করতে পারবে।
          </p>
        ) : null}
      </div>
    </div>
  );
}
