"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function WeeklyReportError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="weekly-report" />;
}
