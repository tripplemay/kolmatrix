import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — KOLMatrix" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <section className="glass-panel ambient-glow flex w-full max-w-md flex-col gap-6 p-8">
        <div className="flex flex-col gap-1">
          <span className="text-on-surface-variant text-[11px] font-semibold tracking-[0.2em] uppercase">
            Neural Velocity
          </span>
          <h1 className="gradient-text text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="text-on-surface-variant text-sm">Use your marketer or admin credentials.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
