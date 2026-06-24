import { adminClient } from "./_shared/supabase.mjs";
import { errorResponse, HttpError, json, preflight, readJson } from "./_shared/http.mjs";

export default async function handler(request) {
  const options = preflight(request);
  if (options) return options;

  try {
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "طريقة الطلب غير مدعومة.");
    const { submissionId } = await readJson(request);
    if (!/^[0-9a-f-]{36}$/i.test(submissionId || "")) {
      throw new HttpError(400, "INVALID_SUBMISSION", "رقم الطلب غير صالح.");
    }

    const supabase = adminClient();
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("id, reference, photo_count, status")
      .eq("id", submissionId)
      .single();
    if (submissionError || !submission) throw new HttpError(404, "NOT_FOUND", "لم يتم العثور على الطلب.");
    if (submission.status !== "draft") return json(200, { ok: true, submission });

    const { data: photos, error: photoError } = await supabase
      .from("submission_photos")
      .select("id, storage_path")
      .eq("submission_id", submissionId)
      .order("sort_order");
    if (photoError) throw photoError;
    if (photos.length !== submission.photo_count) {
      throw new HttpError(409, "PHOTO_COUNT_MISMATCH", "لم تصل جميع الصور المتوقعة.");
    }

    for (const photo of photos) {
      const folder = photo.storage_path.split("/").slice(0, -1).join("/");
      const filename = photo.storage_path.split("/").at(-1);
      const { data: files, error: listError } = await supabase.storage
        .from("qualification-files")
        .list(folder, { search: filename, limit: 1 });
      if (listError || !files?.some((file) => file.name === filename)) {
        throw new HttpError(409, "PHOTO_MISSING", "تعذر تأكيد رفع إحدى الصور. يرجى إعادة المحاولة.", { photoId: photo.id });
      }
    }

    await supabase.from("submission_photos").update({ uploaded: true }).eq("submission_id", submissionId);
    const submittedAt = new Date().toISOString();
    const { data: finalized, error: updateError } = await supabase
      .from("submissions")
      .update({ status: "submitted", submitted_at: submittedAt, pdf_state: "pending" })
      .eq("id", submissionId)
      .select("id, reference, status, pdf_state")
      .single();
    if (updateError) throw updateError;

    await supabase.from("submission_status_history").insert({
      submission_id: submissionId,
      from_status: "draft",
      to_status: "submitted"
    });

    try {
      const baseUrl = new URL(request.url).origin;
      const generationResponse = await fetch(`${baseUrl}/.netlify/functions/generate-pdf-background`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": process.env.INTERNAL_FUNCTION_SECRET || ""
        },
        body: JSON.stringify({ submissionId })
      });
      if (!generationResponse.ok) console.error("Could not queue PDF generation", await generationResponse.text());
    } catch (generationError) {
      console.error("Could not queue PDF generation", generationError);
    }

    return json(200, { ok: true, submission: finalized });
  } catch (error) {
    return errorResponse(error);
  }
}
