import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./http.mjs";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function adminClient() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function requireAdmin(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new HttpError(401, "AUTH_REQUIRED", "يلزم تسجيل الدخول.");

  const supabase = adminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    throw new HttpError(401, "INVALID_SESSION", "انتهت جلسة الدخول أو أصبحت غير صالحة.");
  }

  const { data: membership } = await supabase
    .from("admin_users")
    .select("user_id, display_name")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!membership) throw new HttpError(403, "ADMIN_ONLY", "ليس لديك صلاحية إدارة الطلبات.");
  return { supabase, user: userData.user, membership };
}
