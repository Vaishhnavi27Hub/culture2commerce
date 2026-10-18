import type { Metadata } from "next";
import { DiscoverPage } from "@/components/pages";

export const metadata: Metadata = { title: "Discover an opportunity" };

export default function Page() {
  return <DiscoverPage />;
}
