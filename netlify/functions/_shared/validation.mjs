import { z } from "zod";

const requiredText = z.string().trim().min(1).max(2000);
const email = z.string().trim().email().max(320);

export const photoSchema = z.object({
  name: z.string().trim().min(1).max(180),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(Number(process.env.MAX_PHOTO_BYTES || 5 * 1024 * 1024))
});

export const submissionSchema = z.object({
  data: z.object({
    office_name: requiredText.max(300),
    country: requiredText.max(120),
    city: requiredText.max(160),
    address: requiredText.max(500),
    phone: requiredText.max(80),
    email,
    founded: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().min(1900).max(new Date().getFullYear())),
    legal_form: requiredText.max(100),
    rep_name: requiredText.max(250),
    rep_title: requiredText.max(250),
    rep_phone: requiredText.max(80),
    rep_email: email,
    authorized: requiredText.max(30),
    specializations: requiredText,
    services_desc: requiredText.max(5000),
    experience_years: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().min(0).max(200)),
    project_types: requiredText.max(2000),
    engineers_total: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().min(1).max(100000)),
    qualification: requiredText.max(100),
    has_qms: requiredText.max(30),
    software: requiredText.max(3000),
    worked_sub: requiredText.max(30),
    schedule_cap: requiredText.max(100),
    team_work: requiredText.max(30),
    sign_name: requiredText.max(250),
    sign_title: requiredText.max(250),
    sign_date: requiredText.max(100)
  }).passthrough(),
  photos: z.array(photoSchema).max(Number(process.env.MAX_PHOTOS || 5)).default([]),
  honeypot: z.string().max(0).optional().default("")
});

export function safeExtension(mimeType) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mimeType];
}
