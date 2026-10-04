"use client";

type ErrorScreenProps = {
  title: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorScreen({ title, message, onRetry }: ErrorScreenProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-neutral-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 w-fit rounded-full bg-foreground px-4 py-2 text-sm text-background"
        >
          Try again
        </button>
      ) : null}
    </main>
  );
}
