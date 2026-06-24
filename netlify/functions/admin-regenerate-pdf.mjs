import { errorResponse, HttpError, json, preflight, readJson } from "./_shared/http.mjs";
import { requireAdmin } from "./_shared/supabase.mjs";

export default async function handler(request) {
  const options = preflight(request);
  if (options) return options;
  try {
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    const { supabase } = await requireAdmin(request);
    const { submissionId } = await readJson(request);
    if (!/^[0-9a-f-]{36}$/i.test(submissionId || "")) throw new HttpError(400, "INVALID_ID", "Invalid submission ID.");
    await supabase.from("submissions").update({ pdf_state: "pending", pdf_error: null }).eq("id", submissionId);

    const baseUrl = process.env.URL || process.env.SITE_URL || new URL(request.url).origin;
    const queued = await fetch(`${baseUrl}/.netlify/functions/generate-pdf-background`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": process.env.INTERNAL_FUNCTION_SECRET || "" },
      body: JSON.stringify({ submissionId })
    });
    if (!queued.ok) throw new HttpError(502, "QUEUE_FAILED", "Could not queue PDF generation.");
    return json(202, { ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
