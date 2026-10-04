import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DinerFlow } from "@/components/flow/DinerFlow";
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
    return <DinerFlow restaurant={restaurant} table={table} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="text-xl font-semibold">Can’t load this restaurant</h1>
        <p className="text-sm text-neutral-600">Check your connection and try the QR code again.</p>
      </main>
    );
  }
}
