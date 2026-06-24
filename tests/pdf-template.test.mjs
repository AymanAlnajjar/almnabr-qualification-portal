import test from "node:test";
import assert from "node:assert/strict";
import { renderPdfHtml } from "../netlify/functions/_shared/pdf-template.mjs";

const submission = {
  reference: "QF-20260621-A1B2C3",
  form_data: {
    office_name: "مكتب اختبار للاستشارات",
    country: "مصر",
    city: "القاهرة",
    address: "عنوان الاختبار",
    phone: "+20 100 000 0000",
    email: "office@example.com",
    founded: 2012,
    legal_form: "شركة",
    rep_name: "أحمد محمد",
    rep_title: "المدير العام",
    rep_phone: "+20 100 000 0000",
    rep_email: "ahmed@example.com",
    authorized: "نعم",
    specializations: "التصميم المعماري، التصميم الإنشائي",
    services_desc: "خدمات هندسية متكاملة",
    experience_years: 14,
    project_types: "سكني وتجاري",
    p1_name: "مشروع تجريبي",
    p1_loc: "القاهرة",
    p1_year: "2025",
    p1_scope: "التصميم والإشراف",
    engineers_total: 12,
    qualification: "ماجستير",
    has_qms: "نعم",
    software: "Revit, AutoCAD",
    worked_sub: "نعم",
    schedule_cap: "عالية",
    team_work: "نعم",
    sign_name: "أحمد محمد",
    sign_title: "المدير العام",
    sign_date: "21 يونيو 2026"
  }
};

test("PDF HTML includes the reference, Arabic data and photo", () => {
  const html = renderPdfHtml({
    submission,
    photos: [{ signedUrl: "https://example.com/photo.jpg", original_name: "مشروع.jpg" }],
    logoDataUrl: "data:image/png;base64,AA=="
  });
  assert.match(html, /dir="rtl"/);
  assert.match(html, /QF-20260621-A1B2C3/);
  assert.match(html, /مكتب اختبار للاستشارات/);
  assert.match(html, /https:\/\/example.com\/photo.jpg/);
});

test("PDF HTML escapes untrusted form values and filenames", () => {
  const html = renderPdfHtml({
    submission: { ...submission, form_data: { ...submission.form_data, office_name: "<script>alert(1)</script>" } },
    photos: [{ signedUrl: "https://example.com/photo.jpg", original_name: '"><img src=x onerror=alert(1)>' }],
    logoDataUrl: ""
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /onerror=alert\(1\)>/);
  assert.match(html, /&lt;script&gt;/);
});
