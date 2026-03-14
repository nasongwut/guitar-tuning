"use client";

import Link from "next/link";
import InstallButton from "./component/InstallButton";

function MenuCard({ title, description, href, tone = "blue" }) {
  const tones = {
    blue: "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/15",
    emerald: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15",
    violet: "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/15",
    amber: "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15",
  };

  return (
    <Link
      href={href}
      className={`group block rounded-3xl border p-5 transition duration-200 active:scale-[0.99] ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-white">{title}</div>
          <div className="mt-2 text-sm text-slate-300">{description}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
          Open
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-400">{href}</div>
    </Link>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <InstallButton />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            Audio Menu
          </h1>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">
            เลือกเครื่องมือที่ต้องการใช้งาน
          </p>
        </div>

        <div className="space-y-5">
          <Section
            title="Tools"
            subtitle="เครื่องมือสำหรับจัดการและปรับแต่งเสียง"
          >
            <MenuCard
              title="Equalizer"
              description="31 Band Mic VU Meter + Equalizer"
              href="/tools/equalizer"
              tone="cyan"
            />
          </Section>

          <Section
            title="Tunning"
            subtitle="เครื่องมือสำหรับตั้งสายและตรวจจับเสียง"
          >
            <MenuCard
              title="Guitar Tunning"
              description="เครื่องตั้งสายกีตาร์"
              href="/tunning/guitar"
              tone="emerald"
            />
          </Section>
        </div>
      </div>
    </main>
  );
}