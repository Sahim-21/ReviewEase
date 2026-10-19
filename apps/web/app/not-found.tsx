import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      emoji="🧭"
      title="Page not found"
      message="That link does not match a restaurant or staff page."
      homeHref="/"
    />
  );
}
