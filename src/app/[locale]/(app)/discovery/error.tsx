"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function DiscoveryError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="discovery" />;
}
