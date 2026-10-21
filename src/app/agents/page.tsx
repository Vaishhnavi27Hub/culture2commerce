import type { Metadata } from "next";
import { AgentsPage } from "@/components/pages";

export const metadata: Metadata = { title: "Your Agents at Work" };

export default function Page() {
  return <AgentsPage />;
}
