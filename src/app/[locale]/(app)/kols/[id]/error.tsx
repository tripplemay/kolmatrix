"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function KolDetailError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="kols/[id]" />;
}
