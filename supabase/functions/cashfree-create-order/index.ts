// Zari — Cashfree order creation (STUBBED — see decisions in the build session).
//
// Real flow once Zari's own sandbox Cashfree App ID/Secret exist (set as Edge
// Function secrets, NEVER in frontend code):
//   1. Verify the caller is authenticated and the order belongs to them.
//   2. Create an internal `orders` row with payment_status = 'pending'.
//   3. Call Cashfree's Create Order API with the Zari secret key (server-side only).
//   4. Return the hosted checkout payment_session_id to the frontend.
// Payment is only ever confirmed by cashfree-webhook after signature verification —
// never from this function's response or any frontend callback (spec §24-26).
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return jsonResponse(
    { error: "cashfree_not_configured", message: "Zari's Cashfree sandbox credentials are not set up yet." },
    501,
  );
});
