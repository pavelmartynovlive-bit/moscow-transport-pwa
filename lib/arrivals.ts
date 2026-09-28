export type Arrival = { seconds: number; realtime: boolean };
export type RouteArrival = {
  number: string;
  destination: string;
  color: string;
  arrivals: Arrival[];
};
export type StopBoard = { id: string; label: string; routes: RouteArrival[] };
export type BoardResponse = { stops: StopBoard[]; fetchedAt: number };

const STOPS = [
  { id: "627d1cfb-7127-4e85-bc10-ffccf4663630", label: "В сторону Каширской", routes: ["с848", "м83"] },
  { id: "c5700c22-05cf-474f-97e7-82457062f4af", label: "В сторону Орехово", routes: ["858", "м83"] },
] as const;

type MoscowForecast = { time: number; byTelemetry: number };
type MoscowRoute = { number: string; lastStopName: string; color: string; externalForecast: MoscowForecast[] };
type MoscowStop = { routePath: MoscowRoute[] };

async function fetchStop(id: string): Promise<MoscowStop> {
  const response = await fetch(`https://moscowtransport.app/api/stop_v2/${id}`, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 15, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

  if (!response.ok) throw new Error(`Moscow Transport returned ${response.status}`);
  return response.json() as Promise<MoscowStop>;
}

export async function fetchArrivals(): Promise<BoardResponse> {
  const source = await Promise.all(STOPS.map((stop) => fetchStop(stop.id)));
  const fetchedAt = Date.now();
  const stops = STOPS.map((stop, index) => ({
    id: stop.id,
    label: stop.label,
    routes: stop.routes.map((routeNumber) => {
      const route = source[index].routePath.find(
        (candidate) => candidate.number.toLowerCase() === routeNumber.toLowerCase(),
      );
      return {
        number: routeNumber,
        destination: route?.lastStopName.replaceAll('"', "") ?? "Направление неизвестно",
        color: route?.color ?? "#c2e6ff",
        arrivals: (route?.externalForecast ?? []).slice(0, 3).map((forecast) => ({
          seconds: forecast.time,
          realtime: forecast.byTelemetry === 1,
        })),
      };
    }),
  }));

  return { stops, fetchedAt };
}
