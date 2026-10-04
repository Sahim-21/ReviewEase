import { StepNav } from "@/components/ui/StepNav";

type WelcomeProps = {
  restaurantName: string;
  onNext: () => void;
};

export function Welcome({ restaurantName, onNext }: WelcomeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-lg font-medium leading-snug">How was {restaurantName} this visit?</p>
      <p className="mt-2 text-sm text-neutral-600">
        Tap what you had and how it felt. We only phrase your own notes — then you copy them and post on
        Google yourself. No login, and nothing is posted for you.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-neutral-700">
        <li>Dishes and ratings you pick</li>
        <li>Optional tags and a short note</li>
        <li>A draft in your words, then Google in your browser</li>
      </ul>
      <div className="mt-auto">
        <StepNav nextLabel="Start" onNext={onNext} />
      </div>
    </div>
  );
}
