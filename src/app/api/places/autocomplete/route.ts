import type { NextRequest } from "next/server";
import { autocomplete } from "@/lib/places";
import { isCountryCode } from "@/lib/locations";
import { SESSION, json, placesFailure, signedInUser } from "../route-helpers";

// GET /api/places/autocomplete?q=eko+hotel&country=NG&region=Lagos&session=<uuid>
export async function GET(request: NextRequest) {
  const user = await signedInUser();
  if (user instanceof Response) return user;

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 120);
  const country = (params.get("country") ?? "").toUpperCase();
  const region = (params.get("region") ?? "").trim().slice(0, 120);
  const session = params.get("session") ?? "";

  if (q.length < 2) return json({ suggestions: [] });
  if (!isCountryCode(country) || !SESSION.test(session)) return json({ error: "bad_request" }, 400);

  try {
    return json({ suggestions: await autocomplete(q, country, region, session) });
  } catch (error) {
    return placesFailure(error);
  }
}
