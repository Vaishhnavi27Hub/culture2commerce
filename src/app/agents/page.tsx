import type { Metadata } from "next";
import { AgentsPage } from "@/components/pages";

export const metadata: Metadata = { title: "Agents at work" };

export default function Page() {
  return <AgentsPage />;
}
