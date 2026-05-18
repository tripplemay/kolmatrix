"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function OutreachError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="outreach" />;
}
