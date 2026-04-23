// Next.js instrumentation hook. Runs once per process (server + edge)
// at boot. We use it to side-effect-register background job handlers
// so every jobQueue.add() call has a handler available.
//
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/jobs/handlers/register");
  }
}
