"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function CrmError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="crm" />;
}
