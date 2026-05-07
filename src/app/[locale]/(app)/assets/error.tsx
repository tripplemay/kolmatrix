"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

/**
 * BL-052 F009 · /assets route error boundary.
 *
 * Closes the last 1/11 page that did not yet have an error.tsx — fetch
 * failures previously bubbled to the global handler and showed a blank
 * white screen. Mirrors the dashboard variant; ErrorBoundary handles
 * the Try-again / Back-to-dashboard CTAs and the `reset` prop.
 */
export default function AssetsError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="assets" />;
}
