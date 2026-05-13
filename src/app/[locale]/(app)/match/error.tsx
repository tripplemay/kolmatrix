"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function MatchError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="match" />;
}
