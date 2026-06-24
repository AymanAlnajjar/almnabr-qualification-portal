import { errorResponse, HttpError, json, preflight } from "./_shared/http.mjs";
import { requireAdmin } from "./_shared/supabase.mjs";

export default async function handler(request) {
  const options = preflight(request);
  if (options) return options;
  try {
    if (request.method !== "GET") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    const { supabase } = await requireAdmin(request);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 25)));
    const status = url.searchParams.get("status") || "";
    const search = (url.searchParams.get("search") || "").trim().replaceAll(/[%,()]/g, "");

    let query = supabase.from("submissions")
      .select("id,reference,office_name,representative_email,status,pdf_state,photo_count,submitted_at,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`reference.ilike.%${search}%,office_name.ilike.%${search}%,representative_email.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;
    return json(200, { ok: true, items: data, page, pageSize, total: count });
  } catch (error) {
    return errorResponse(error);
  }
}
