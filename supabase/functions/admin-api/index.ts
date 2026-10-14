// Zari — privileged admin actions that need the service role key and so can't
// run in the browser: creating admin logins, enabling/disabling them, sending
// access-reset emails, and reporting whether payment secrets are configured.
//
// Every request must carry the caller's own Supabase session (Authorization:
// Bearer <access token>). The caller's admin role is looked up server-side on
// every call — nothing from the request body is trusted for authorisation.
//
// Deploy:  supabase functions deploy admin-api
// Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//          Optional ADMIN_ALLOWED_ORIGINS="https://zari.example,https://www.zari.example"
//          Optional ADMIN_SITE_URL="https://zari.example" (used in invite/reset links)
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";

const allowedOrigins = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? "").split(",")
  .map((s) => s.trim()).filter(Boolean);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = allowedOrigins.length === 0
    ? "*"
    : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Caller = {
  id: string;
  email: string;
  roleKey: string;
  permissions: string[];
};

async function getCaller(
  admin: SupabaseClient,
  req: Request,
): Promise<Caller | null> {
  const token = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: row } = await admin
    .from("admins")
    .select("id, email, is_active, admin_roles(key, permissions)")
    .eq("id", data.user.id)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const role = (row as any)?.admin_roles;
  if (!row || !row.is_active || !role) return null;
  return {
    id: row.id,
    email: row.email ?? data.user.email ?? "",
    roleKey: role.key,
    permissions: role.permissions ?? [],
  };
}

const can = (c: Caller, perm: string) =>
  c.permissions.includes("*") || c.permissions.includes(perm);

async function log(
  admin: SupabaseClient,
  c: Caller,
  action: string,
  entityId: string | null,
  summary: string,
  changes: unknown = {},
) {
  await admin.from("admin_activity_log").insert({
    actor_id: c.id,
    actor_email: c.email,
    action,
    entity: "admins",
    entity_id: entityId,
    summary,
    changes,
  });
}

function siteUrl(req: Request) {
  const configured = Deno.env.get("ADMIN_SITE_URL");
  if (configured) return configured.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  return origin &&
      (allowedOrigins.length === 0 || allowedOrigins.includes(origin))
    ? origin
    : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const caller = await getCaller(admin, req);
  if (!caller) return json(req, { error: "not_authorised" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }
  const action = String(body.action ?? "");

  // ---- Payment configuration status (never returns the secret values) ----
  if (action === "payment_status") {
    if (!can(caller, "settings")) {
      return json(req, { error: "not_authorised" }, 403);
    }
    return json(req, {
      cashfree_app_id: Boolean(Deno.env.get("CASHFREE_APP_ID")),
      cashfree_secret_key: Boolean(Deno.env.get("CASHFREE_SECRET_KEY")),
      cashfree_webhook_secret: Boolean(Deno.env.get("CASHFREE_WEBHOOK_SECRET")),
      cashfree_env: Deno.env.get("CASHFREE_ENV") ?? null,
    });
  }

  // ---- Everything below manages admin accounts: Super Admin only ----
  if (caller.roleKey !== "super_admin") {
    return json(req, { error: "not_authorised" }, 403);
  }

  const targetId = typeof body.admin_id === "string" ? body.admin_id : "";
  if (action !== "create" && !UUID_RE.test(targetId)) {
    return json(req, { error: "invalid_admin_id" }, 400);
  }
  if (action !== "create" && targetId === caller.id) {
    return json(req, {
      error:
        "You can't change your own role or access. Ask another Super Admin.",
    }, 400);
  }

  async function roleExists(roleId: unknown) {
    if (typeof roleId !== "string" || !UUID_RE.test(roleId)) return false;
    const { data } = await admin.from("admin_roles").select("id").eq(
      "id",
      roleId,
    ).maybeSingle();
    return Boolean(data);
  }

  if (action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim().slice(0, 120) || null;
    const password = typeof body.password === "string" ? body.password : "";
    if (!EMAIL_RE.test(email)) {
      return json(req, { error: "Enter a valid email address." }, 400);
    }
    if (!(await roleExists(body.role_id))) {
      return json(req, { error: "Choose a valid role." }, 400);
    }
    if (
      password &&
      (password.length < 12 || !/[A-Za-z]/.test(password) ||
        !/[0-9]/.test(password))
    ) {
      return json(req, {
        error:
          "Temporary password must be at least 12 characters with letters and numbers.",
      }, 400);
    }

    // Admin logins are kept separate from customer accounts: an email that
    // already has a customer account can't be turned into an admin.
    const { data: existing } = await admin.rpc("admin_lookup_user_by_email", {
      p_email: email,
    });
    if (existing) {
      return json(req, {
        error:
          "This email already has an account on the store. Use a separate email for admin access.",
      }, 409);
    }

    let userId: string;
    if (password) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, is_admin_account: true },
      });
      if (error || !data.user) {
        return json(req, {
          error: error?.message ?? "Could not create the login.",
        }, 400);
      }
      userId = data.user.id;
    } else {
      const redirectTo = siteUrl(req)
        ? `${siteUrl(req)}/admin/?reset=1`
        : undefined;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName, is_admin_account: true },
      });
      if (error || !data.user) {
        return json(req, {
          error: error?.message ?? "Could not send the invite.",
        }, 400);
      }
      userId = data.user.id;
    }
    const { error: insErr } = await admin.from("admins").insert({
      id: userId,
      role_id: body.role_id,
      email,
      full_name: fullName,
      is_active: true,
      created_by: caller.id,
    });
    if (insErr) {
      await admin.auth.admin.deleteUser(userId);
      return json(req, { error: insErr.message }, 400);
    }
    await log(admin, caller, "create", userId, email, {
      role_id: body.role_id,
      invited: !password,
    });
    return json(req, { ok: true, id: userId, invited: !password });
  }

  const { data: target } = await admin.from("admins").select(
    "id, email, role_id, is_active",
  ).eq("id", targetId).maybeSingle();
  if (!target) return json(req, { error: "Admin not found." }, 404);

  if (action === "set_role") {
    if (!(await roleExists(body.role_id))) {
      return json(req, { error: "Choose a valid role." }, 400);
    }
    const { error } = await admin.from("admins").update({
      role_id: body.role_id,
    }).eq("id", targetId);
    if (error) return json(req, { error: error.message }, 400);
    await log(admin, caller, "update", targetId, target.email ?? "", {
      role_id: { from: target.role_id, to: body.role_id },
    });
    return json(req, { ok: true });
  }

  if (action === "set_active") {
    const active = body.active === true;
    const { error } = await admin.from("admins").update({ is_active: active })
      .eq("id", targetId);
    if (error) return json(req, { error: error.message }, 400); // e.g. "At least one active Super Admin is required."
    // Banning also stops their existing session from being refreshed.
    await admin.auth.admin.updateUserById(targetId, {
      ban_duration: active ? "none" : "876000h",
    });
    await log(admin, caller, "update", targetId, target.email ?? "", {
      is_active: { from: target.is_active, to: active },
    });
    return json(req, { ok: true });
  }

  if (action === "reset_access") {
    if (!target.email) {
      return json(req, { error: "This admin has no email on file." }, 400);
    }
    const redirectTo = siteUrl(req)
      ? `${siteUrl(req)}/admin/?reset=1`
      : undefined;
    const { error } = await admin.auth.resetPasswordForEmail(target.email, {
      redirectTo,
    });
    if (error) return json(req, { error: error.message }, 400);
    await log(admin, caller, "reset_access", targetId, target.email, {});
    return json(req, { ok: true });
  }

  if (action === "remove") {
    const { error } = await admin.from("admins").delete().eq("id", targetId);
    if (error) return json(req, { error: error.message }, 400);
    await admin.auth.admin.updateUserById(targetId, {
      ban_duration: "876000h",
    });
    await log(admin, caller, "delete", targetId, target.email ?? "", {});
    return json(req, { ok: true });
  }

  return json(req, { error: "unknown_action" }, 400);
});
