import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DinerFlow } from "@/components/flow/DinerFlow";
import { ErrorScreen } from "@/components/ui/ErrorScreen";
import { ApiError, getRestaurant } from "@/lib/api";

type RestaurantPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const restaurant = await getRestaurant(slug);
    if (restaurant.active === false) {
      return { title: "Not available" };
    }
    return {
      title: restaurant.name,
      description: `Tell ${restaurant.name} how your visit went. Phrase your own notes, then post on Google yourself.`,
    };
  } catch {
    return { title: "Restaurant" };
  }
}

export default async function RestaurantFlowPage({ params, searchParams }: RestaurantPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const table = Array.isArray(query.t) ? query.t[0] : query.t;
  try {
    const restaurant = await getRestaurant(slug);
    if (restaurant.active === false) {
      return (
        <ErrorScreen
          emoji="⏸️"
          title="This restaurant isn't taking reviews right now"
          message="Please check back later."
        />
      );
    }
    return <DinerFlow restaurant={restaurant} table={table} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    return (
      <ErrorScreen
        emoji="📡"
        title="Can’t load this restaurant"
        message="Check your connection and try the QR code again."
      />
    );
  }
}
