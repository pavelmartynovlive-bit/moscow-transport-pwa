import { fetchArrivals } from "@/lib/arrivals";

export async function GET() {
  try {
    const data = await fetchArrivals();
    return Response.json(data, { headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=10, stale-while-revalidate=20",
    } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось получить прогноз" },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
