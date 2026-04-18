export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-12">
      <section className="glass-panel ambient-glow flex max-w-xl flex-col gap-6 p-10">
        <span className="text-on-surface-variant text-xs font-semibold tracking-[0.15em] uppercase">
          Neural Velocity
        </span>
        <h1 className="gradient-text text-4xl font-bold tracking-tight">KOLMatrix</h1>
        <p className="text-on-surface text-base leading-relaxed">
          AI-driven KOL campaign command center. Scaffold online — routes, auth, and the
          pixel-perfect Dashboard arrive in subsequent batches.
        </p>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-cyan">bolt</span>
          <span className="text-on-surface-variant text-sm">
            F001 + F002 complete · Neural Velocity tokens live
          </span>
        </div>
      </section>
    </main>
  );
}
