import { adminClient } from "./_shared/supabase.mjs";
import { generatePdfForSubmission } from "./_shared/pdf-generator.mjs";
import { errorResponse, HttpError, json, readJson } from "./_shared/http.mjs";

export default async function handler(request) {
  let submissionId;
  const supabase = adminClient();
  try {
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    if (!process.env.INTERNAL_FUNCTION_SECRET || request.headers.get("x-internal-secret") !== process.env.INTERNAL_FUNCTION_SECRET) {
      throw new HttpError(403, "FORBIDDEN", "Forbidden.");
    }
    ({ submissionId } = await readJson(request));
    if (!/^[0-9a-f-]{36}$/i.test(submissionId || "")) throw new HttpError(400, "INVALID_ID", "Invalid submission ID.");

    await generatePdfForSubmission({ supabase, submissionId });
    return json(202, { ok: true });
  } catch (error) {
    if (submissionId) {
      await supabase
        .from("submissions")
        .update({ pdf_state: "failed", pdf_error: String(error.message || error).slice(0, 2000) })
        .eq("id", submissionId);
    }
    return errorResponse(error);
  }
}
