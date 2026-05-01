"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function DashboardError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="dashboard" />;
}
