import { errorResponse, HttpError, json, preflight } from "./_shared/http.mjs";
import { requireAdmin } from "./_shared/supabase.mjs";

export default async function handler(request) {
  const options = preflight(request);
  if (options) return options;
  try {
    if (request.method !== "GET") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    const { supabase } = await requireAdmin(request);
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "INVALID_ID", "Invalid submission ID.");

    const [{ data: submission, error }, { data: photos }, { data: notes }, { data: history }] = await Promise.all([
      supabase.from("submissions").select("*").eq("id", id).single(),
      supabase.from("submission_photos").select("*").eq("submission_id", id).order("sort_order"),
      supabase.from("submission_notes").select("id,note,author_id,created_at").eq("submission_id", id).order("created_at", { ascending: false }),
      supabase.from("submission_status_history").select("*").eq("submission_id", id).order("created_at", { ascending: false })
    ]);
    if (error) throw error;

    const signedPhotos = [];
    for (const photo of photos || []) {
      const { data: signed } = await supabase.storage.from("qualification-files").createSignedUrl(photo.storage_path, 900);
      signedPhotos.push({ ...photo, url: signed?.signedUrl || "" });
    }
    let pdfUrl = "";
    if (submission.pdf_path) {
      const { data: signed } = await supabase.storage.from("qualification-files").createSignedUrl(submission.pdf_path, 900, {
        download: `${submission.reference}.pdf`
      });
      pdfUrl = signed?.signedUrl || "";
    }

    return json(200, { ok: true, submission, photos: signedPhotos, notes: notes || [], history: history || [], pdfUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
