import type { Metadata } from "next";
import { RecommendationPage } from "@/components/pages";

export const metadata: Metadata = { title: "Recommendation" };

export default function Page() {
  return <RecommendationPage />;
}
