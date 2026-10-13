import { getStoredRun } from "@/server/api/run-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns a recent run from in-memory storage. Runs are not persisted across restarts. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const run = getStoredRun(id);
  if (!run) {
    return Response.json({ error: "Run not found. Runs are kept in memory only; download the JSON to keep one." }, { status: 404 });
  }
  return Response.json(run, { headers: { "Cache-Control": "no-store" } });
}
