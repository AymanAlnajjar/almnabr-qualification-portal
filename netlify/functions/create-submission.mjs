import { randomBytes } from "node:crypto";
import { adminClient } from "./_shared/supabase.mjs";
import { errorResponse, HttpError, json, preflight, readJson } from "./_shared/http.mjs";
import { safeExtension, submissionSchema } from "./_shared/validation.mjs";

function makeReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `QF-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export default async function handler(request) {
  const options = preflight(request);
  if (options) return options;

  try {
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "طريقة الطلب غير مدعومة.");
    const parsed = submissionSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(422, "VALIDATION_FAILED", "يرجى مراجعة الحقول المطلوبة.", parsed.error.flatten());
    }

    const { data: formData, photos } = parsed.data;
    const supabase = adminClient();
    const reference = makeReference();

    const { data: submission, error: insertError } = await supabase
      .from("submissions")
      .insert({
        reference,
        form_data: formData,
        office_name: formData.office_name,
        representative_email: formData.rep_email,
        photo_count: photos.length
      })
      .select("id, reference")
      .single();

    if (insertError) throw insertError;

    const uploads = [];
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const photoId = crypto.randomUUID();
      const path = `submissions/${submission.id}/photos/${photoId}.${safeExtension(photo.type)}`;
      const { data: signed, error: signedError } = await supabase.storage
        .from("qualification-files")
        .createSignedUploadUrl(path);
      if (signedError) throw signedError;

      const { error: photoError } = await supabase.from("submission_photos").insert({
        id: photoId,
        submission_id: submission.id,
        storage_path: path,
        original_name: photo.name,
        mime_type: photo.type,
        size_bytes: photo.size,
        sort_order: index
      });
      if (photoError) throw photoError;

      uploads.push({
        photoId,
        path,
        token: signed.token,
        signedUrl: signed.signedUrl
      });
    }

    return json(201, { ok: true, submission, uploads });
  } catch (error) {
    return errorResponse(error);
  }
}
