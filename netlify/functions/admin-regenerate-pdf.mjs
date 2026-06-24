import { errorResponse, HttpError, json, preflight, readJson } from "./_shared/http.mjs";
import { generatePdfForSubmission } from "./_shared/pdf-generator.mjs";
import { requireAdmin } from "./_shared/supabase.mjs";

export default async function handler(request) {
  const options = preflight(request);
  if (options) return options;

  let submissionId;
  try {
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    const { supabase } = await requireAdmin(request);
    ({ submissionId } = await readJson(request));
    if (!/^[0-9a-f-]{36}$/i.test(submissionId || "")) throw new HttpError(400, "INVALID_ID", "Invalid submission ID.");

    const submission = await generatePdfForSubmission({ supabase, submissionId });
    const { data: signed } = await supabase.storage.from("qualification-files").createSignedUrl(submission.pdf_path, 900, {
      download: `${submission.reference}.pdf`
    });

    return json(200, { ok: true, submission, pdfUrl: signed?.signedUrl || "" });
  } catch (error) {
    try {
      if (submissionId) {
        const { supabase } = await requireAdmin(request);
        await supabase
          .from("submissions")
          .update({ pdf_state: "failed", pdf_error: String(error.message || error).slice(0, 2000) })
          .eq("id", submissionId);
      }
    } catch {
      // Preserve the original error response.
    }
    return errorResponse(error);
  }
}
