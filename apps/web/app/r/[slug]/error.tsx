"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function RestaurantLoadError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorScreen
      title="Can’t load this restaurant"
      message="Check your connection and try the QR code again."
      onRetry={reset}
    />
  );
}
