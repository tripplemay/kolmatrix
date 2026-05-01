"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function CampaignsError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="campaigns" />;
}
