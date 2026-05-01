"use client";

import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/common";

export default function CampaignDetailError(props: ErrorBoundaryProps) {
  return <ErrorBoundary {...props} scope="campaigns/[id]" />;
}
