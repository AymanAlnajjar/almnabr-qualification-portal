import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { adminClient } from "./_shared/supabase.mjs";
import { renderPdfHtml } from "./_shared/pdf-template.mjs";
import { errorResponse, HttpError, json, readJson } from "./_shared/http.mjs";

async function optionalDataUrl(path, mimeType) {
  try {
    const bytes = await readFile(path);
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
}

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

    await supabase.from("submissions").update({ pdf_state: "generating", pdf_error: null }).eq("id", submissionId);
    const { data: submission, error: submissionError } = await supabase
      .from("submissions").select("*").eq("id", submissionId).single();
    if (submissionError) throw submissionError;

    const { data: photoRows, error: photoError } = await supabase
      .from("submission_photos").select("*").eq("submission_id", submissionId).order("sort_order");
    if (photoError) throw photoError;

    const photos = [];
    for (const photo of photoRows) {
      const { data: signed, error: signError } = await supabase.storage
        .from("qualification-files").createSignedUrl(photo.storage_path, 3600);
      if (signError) throw signError;
      photos.push({ ...photo, signedUrl: signed.signedUrl });
    }

    const publicAssets = join(process.cwd(), "public", "assets");
    const logoDataUrl = await optionalDataUrl(join(publicAssets, "logo.png"), "image/png");
    const fontDataUrl = await optionalDataUrl(join(publicAssets, "ibm-plex-sans-arabic.ttf"), "font/ttf");
    const html = renderPdfHtml({ submission, photos, logoDataUrl, fontDataUrl });

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    let pdf;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    } finally {
      await browser.close();
    }

    const pdfPath = `submissions/${submissionId}/application.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("qualification-files")
      .upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true, cacheControl: "0" });
    if (uploadError) throw uploadError;

    await supabase.from("submissions").update({ pdf_state: "ready", pdf_path: pdfPath, pdf_error: null }).eq("id", submissionId);
    return json(202, { ok: true });
  } catch (error) {
    if (submissionId) {
      await supabase.from("submissions").update({ pdf_state: "failed", pdf_error: String(error.message || error).slice(0, 2000) }).eq("id", submissionId);
    }
    return errorResponse(error);
  }
}
