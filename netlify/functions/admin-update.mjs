import { errorResponse, HttpError, json, preflight, readJson } from "./_shared/http.mjs";
import { requireAdmin } from "./_shared/supabase.mjs";

const allowedStatuses = new Set(["submitted", "under_review", "qualified", "rejected", "archived"]);

export default async function handler(request) {
  const options = preflight(request);
  if (options) return options;
  try {
    if (request.method !== "PATCH") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    const { supabase, user } = await requireAdmin(request);
    const { submissionId, status, note } = await readJson(request);
    if (!/^[0-9a-f-]{36}$/i.test(submissionId || "")) throw new HttpError(400, "INVALID_ID", "Invalid submission ID.");

    if (status) {
      if (!allowedStatuses.has(status)) throw new HttpError(422, "INVALID_STATUS", "Invalid status.");
      const { data: existing, error: readError } = await supabase.from("submissions").select("status").eq("id", submissionId).single();
      if (readError) throw readError;
      const { error: updateError } = await supabase.from("submissions").update({ status }).eq("id", submissionId);
      if (updateError) throw updateError;
      if (existing.status !== status) await supabase.from("submission_status_history").insert({
        submission_id: submissionId, from_status: existing.status, to_status: status, changed_by: user.id
      });
    }

    if (typeof note === "string" && note.trim()) {
      if (note.trim().length > 4000) throw new HttpError(422, "NOTE_TOO_LONG", "Note is too long.");
      const { error: noteError } = await supabase.from("submission_notes").insert({
        submission_id: submissionId, author_id: user.id, note: note.trim()
      });
      if (noteError) throw noteError;
    }

    return json(200, { ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
