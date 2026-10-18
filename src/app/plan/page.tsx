import type { Metadata } from "next";
import { PlanPage } from "@/components/pages";

export const metadata: Metadata = { title: "Pitch and pilot plan" };

export default function Page() {
  return <PlanPage />;
}
