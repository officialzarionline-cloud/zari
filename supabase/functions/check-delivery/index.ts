// Zari — delivery serviceability check.
// Customer-facing: takes a PIN code, returns { serviceable, city? } only —
// never leaks courier/provider internals to the frontend (see spec §21/§22).
//
// TODO once a shipping provider (Delhivery / Shiprocket / Fship) has real Zari
// credentials in `shipping_providers.config` (service-role only, never in
// frontend code): call that provider's serviceability API here instead of the
// placeholder "always serviceable" response below.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { pincode } = await req.json().catch(() => ({ pincode: null }));
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return jsonResponse({ serviceable: false, error: "invalid_pincode" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: providers } = await supabase
    .from("shipping_providers")
    .select("name, config")
    .eq("is_active", true);

  if (!providers || providers.length === 0) {
    // No live provider configured yet — be honest rather than pretending everything ships.
    return jsonResponse({ serviceable: false, reason: "no_provider_configured" });
  }

  // Placeholder until a real provider call is wired in: do not claim serviceability
  // for money-taking flows based on this stub. Checkout revalidates again anyway.
  return jsonResponse({ serviceable: true, city: null });
});
