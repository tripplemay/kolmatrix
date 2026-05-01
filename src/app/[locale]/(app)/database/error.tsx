"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function DatabaseError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="database" />;
}
