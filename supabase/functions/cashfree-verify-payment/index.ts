// Zari — server-side payment status re-check (STUBBED), used by the order-success
// page to poll actual status rather than trust the browser's return-from-Cashfree
// redirect. See cashfree-webhook/index.ts for why the webhook is the source of truth.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return jsonResponse({ error: "cashfree_not_configured" }, 501);
});
