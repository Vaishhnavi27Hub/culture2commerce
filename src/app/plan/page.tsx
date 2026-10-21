import type { Metadata } from "next";
import { PlanPage } from "@/components/pages";

export const metadata: Metadata = { title: "Launch Plan" };

export default function Page() {
  return <PlanPage />;
}
