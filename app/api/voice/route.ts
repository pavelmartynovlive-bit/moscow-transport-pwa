import { fetchArrivals, type Arrival, type StopBoard } from "@/lib/arrivals";

type SpokenArrival = Arrival & { route: string };

function routeName(route: string) {
  return route.toUpperCase();
}

function minuteWord(value: number) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return "минут";
  if (mod10 === 1) return "минуту";
  if (mod10 >= 2 && mod10 <= 4) return "минуты";
  return "минут";
}

function arrivalPhrase(arrival: SpokenArrival, omitRoute = false) {
  const prefix = omitRoute ? "Следующий" : routeName(arrival.route);
  const schedule = arrival.realtime ? "" : " по расписанию";

  if (arrival.seconds <= 45) return `${prefix}${schedule} подъезжает`;
  const minutes = Math.max(1, Math.round(arrival.seconds / 60));
  return `${prefix}${schedule} через ${minutes} ${minuteWord(minutes)}`;
}

function selectArrivals(stop: StopBoard): SpokenArrival[] {
  const all = stop.routes
    .flatMap((route) => route.arrivals.map((arrival) => ({ ...arrival, route: route.number })))
    .filter((arrival) => arrival.seconds >= -45)
    .sort((a, b) => a.seconds - b.seconds);
  const live = all.filter((arrival) => arrival.realtime).slice(0, 2);

  if (live.length === 2) return live;
  const selected = new Set(live);
  const fallback = all.filter((arrival) => !selected.has(arrival)).slice(0, 2 - live.length);
  return [...live, ...fallback].sort((a, b) => a.seconds - b.seconds);
}

function stopPhrase(stop: StopBoard) {
  const arrivals = selectArrivals(stop);
  if (!arrivals.length) return `${stop.label}: данных о ближайших автобусах нет`;

  const spoken = arrivals.map((arrival, index) => {
    const previous = arrivals[index - 1];
    return arrivalPhrase(arrival, Boolean(previous && previous.route === arrival.route));
  });
  return `${stop.label}: ${spoken.join(". ")}`;
}

export async function GET() {
  try {
    const data = await fetchArrivals();
    return new Response(`${data.stops.map(stopPhrase).join(". ")}.`, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=10, stale-while-revalidate=20",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return new Response("Сейчас не удалось получить данные об автобусах. Попробуйте ещё раз через минуту.", {
      status: 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
