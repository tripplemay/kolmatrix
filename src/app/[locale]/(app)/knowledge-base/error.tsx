"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function KnowledgeBaseError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="knowledge-base" />;
}
