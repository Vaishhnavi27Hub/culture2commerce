import { APP_NAME, TEAM_CREDIT } from "@/lib/brand";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-4">
      <h1 className="text-4xl font-bold tracking-tight text-brand">{APP_NAME}</h1>
      <p className="text-lg">
        A micro-business opportunity discovery agent. The full app arrives in the next phases.
      </p>
      <p className="text-sm opacity-70">{TEAM_CREDIT}</p>
    </main>
  );
}
