// Zari — turns a lat/lng (from "Use My Current Location") into a city/pincode guess.
// TODO: wire a real geocoding provider once one is chosen for Zari (do not reuse
// You & Me's key). Until then this returns null so the UI falls back to manual PIN entry.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { lat, lng } = await req.json().catch(() => ({}));
  if (typeof lat !== "number" || typeof lng !== "number") {
    return jsonResponse({ error: "invalid_coordinates" }, 400);
  }
  return jsonResponse(null, 501);
});
