"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function RoiError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="roi" />;
}
