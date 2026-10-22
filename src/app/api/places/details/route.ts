import type { NextRequest } from "next/server";
import { placeDetails } from "@/lib/places";
import { SESSION, json, placesFailure, signedInUser } from "../route-helpers";

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

// GET /api/places/details?id=<placeId>&session=<uuid>
export async function GET(request: NextRequest) {
  const user = await signedInUser();
  if (user instanceof Response) return user;

  const params = request.nextUrl.searchParams;
  const id = params.get("id") ?? "";
  const session = params.get("session") ?? "";
  if (!PLACE_ID.test(id) || !SESSION.test(session)) return json({ error: "bad_request" }, 400);

  try {
    return json({ place: await placeDetails(id, session) });
  } catch (error) {
    return placesFailure(error);
  }
}
