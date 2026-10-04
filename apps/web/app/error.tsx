"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorScreen
      title="Something went wrong"
      message="Refresh or try again. Your notes were not posted anywhere."
      onRetry={reset}
    />
  );
}
