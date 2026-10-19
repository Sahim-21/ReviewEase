import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      emoji="🔍"
      title="Hmm, we can't find this restaurant"
      message="Check the QR code and try again. It may be out of date."
    />
  );
}
