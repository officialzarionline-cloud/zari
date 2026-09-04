// Zari — Cashfree webhook (STUBBED). This is the ONLY place an order may be
// marked payment_status = 'paid'. Before enabling: verify the webhook signature
// with Zari's own Cashfree webhook secret, and make the handler idempotent
// (a retried webhook for an already-paid order must be a no-op, not a double
// stock decrement) — see spec §25/§41.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return jsonResponse({ error: "cashfree_not_configured" }, 501);
});
