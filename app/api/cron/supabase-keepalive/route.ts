import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function reply(status: number, ok: boolean) {
  return Response.json({ ok }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Supabase keepalive: CRON_SECRET is not configured");
    return reply(503, false);
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return reply(401, false);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("Supabase keepalive: Supabase configuration is missing");
    return reply(503, false);
  }

  try {
    // Query Postgres through the Data API, using only the existing publishable
    // key and anon RLS permissions. HEAD never downloads product information.
    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/products?select=id&limit=1`,
      {
        method: "HEAD",
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      console.error("Supabase keepalive: Data API returned", response.status);
      return reply(502, false);
    }
    console.info("Supabase keepalive: database responded successfully");
    return reply(200, true);
  } catch {
    console.error("Supabase keepalive: Data API request failed or timed out");
    return reply(502, false);
  }
}
