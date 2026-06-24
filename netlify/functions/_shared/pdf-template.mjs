const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const show = (value) => value === "" || value == null ? "-" : esc(value);

function rows(items) {
  return items.map(([label, value]) => `
    <div class="datum">
      <div class="datum-label">${esc(label)}</div>
      <div class="datum-value">${show(value)}</div>
    </div>`).join("");
}

function projectRows(data) {
  const projects = Array.from({ length: 5 }, (_, index) => {
    const n = index + 1;
    return {
      name: data[`p${n}_name`],
      location: data[`p${n}_loc`],
      year: data[`p${n}_year`],
      scope: data[`p${n}_scope`]
    };
  }).filter((project) => Object.values(project).some(Boolean));

  if (!projects.length) return '<p class="empty">لم يتم إدخال مشاريع.</p>';
  return `<table>
    <thead><tr><th>#</th><th>المشروع</th><th>الموقع</th><th>السنة</th><th>نطاق العمل</th></tr></thead>
    <tbody>${projects.map((project, index) => `<tr>
      <td>${index + 1}</td><td>${show(project.name)}</td><td>${show(project.location)}</td>
      <td>${show(project.year)}</td><td>${show(project.scope)}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

export function renderPdfHtml({ submission, photos, logoDataUrl, fontDataUrl = "" }) {
  const data = submission.form_data;
  const photoMarkup = photos.length
    ? `<div class="photo-grid">${photos.map((photo, index) => `<figure>
        <img src="${esc(photo.signedUrl)}" alt="صورة مشروع ${index + 1}">
        <figcaption>${index + 1}. ${esc(photo.original_name)}</figcaption>
      </figure>`).join("")}</div>`
    : '<p class="empty">لم يتم إرفاق صور.</p>';

  return `<!doctype html>
  <html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    ${fontDataUrl ? `@font-face{font-family:PlexArabic;src:url(${fontDataUrl}) format('truetype');font-weight:100 900;}` : ""}
    @page { size: A4; margin: 18mm 14mm 18mm; }
    * { box-sizing: border-box; }
    body { margin:0; color:#1c2b3a; font-family:PlexArabic,"Arial",sans-serif; font-size:10.5pt; line-height:1.65; }
    header { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #0f4c7a; padding-bottom:10px; margin-bottom:18px; }
    .brand { display:flex; align-items:center; gap:10px; }
    .brand img { width:48px; height:48px; object-fit:contain; }
    .brand-name { font-weight:700; color:#0f4c7a; font-size:14pt; }
    .brand-sub { color:#5a6e80; font-size:8.5pt; }
    .doc-title { text-align:left; }
    .doc-title h1 { margin:0; font-size:15pt; color:#0f4c7a; }
    .reference { direction:ltr; color:#5a6e80; font-size:9pt; }
    section { break-inside:avoid; margin:0 0 14px; }
    section.break-before { break-before:page; }
    h2 { margin:0 0 8px; padding:7px 10px; font-size:11.5pt; color:#0f4c7a; background:#e8f2fb; border-right:4px solid #0f4c7a; }
    .data-grid { display:grid; grid-template-columns:1fr 1fr; border:1px solid #d1dde8; border-bottom:0; }
    .datum { display:grid; grid-template-columns:42% 58%; min-height:34px; border-bottom:1px solid #d1dde8; }
    .datum:nth-child(odd) { border-left:1px solid #d1dde8; }
    .datum-label { padding:7px 9px; color:#5a6e80; background:#f5f8fb; font-weight:600; }
    .datum-value { padding:7px 9px; overflow-wrap:anywhere; white-space:pre-wrap; }
    .full { grid-column:1/-1; }
    table { width:100%; border-collapse:collapse; font-size:9pt; }
    th { background:#e8f2fb; color:#0f4c7a; font-weight:700; }
    th,td { border:1px solid #d1dde8; padding:6px 7px; text-align:right; vertical-align:top; }
    .photo-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    figure { margin:0; border:1px solid #d1dde8; border-radius:6px; overflow:hidden; break-inside:avoid; }
    figure img { width:100%; height:210px; display:block; object-fit:contain; background:#f5f8fb; }
    figcaption { padding:6px 8px; color:#5a6e80; font-size:8.5pt; }
    .declaration { padding:12px; border:1px solid #c2d5e8; background:#f0f5fa; border-radius:6px; }
    .empty { color:#5a6e80; font-style:italic; }
    footer { position:fixed; bottom:-12mm; right:0; left:0; color:#73879a; font-size:8pt; border-top:1px solid #d1dde8; padding-top:4px; display:flex; justify-content:space-between; }
  </style></head><body>
    <header>
      <div class="brand"><img src="${logoDataUrl}" alt=""><div><div class="brand-name">المنابر للاستشارات الهندسية</div><div class="brand-sub">نموذج تأهيل مكتب هندسي</div></div></div>
      <div class="doc-title"><h1>طلب تأهيل</h1><div class="reference">${esc(submission.reference)}</div></div>
    </header>

    <section><h2>البيانات العامة للمكتب</h2><div class="data-grid">${rows([
      ["اسم المكتب", data.office_name], ["الدولة", data.country], ["المدينة", data.city], ["العنوان", data.address],
      ["الهاتف", data.phone], ["البريد الرسمي", data.email], ["الموقع الإلكتروني", data.website],
      ["سنة التأسيس", data.founded], ["الشكل القانوني", data.legal_form]
    ])}</div></section>

    <section><h2>ممثل المكتب</h2><div class="data-grid">${rows([
      ["الاسم", data.rep_name], ["المسمى الوظيفي", data.rep_title], ["الهاتف المباشر", data.rep_phone],
      ["البريد الإلكتروني", data.rep_email], ["مفوض بالتعاقد", data.authorized]
    ])}</div></section>

    <section><h2>التخصصات والخدمات</h2><div class="data-grid">${rows([
      ["التخصصات", data.specializations], ["تخصصات أخرى", data.spec_other], ["وصف الخدمات", data.services_desc]
    ])}</div></section>

    <section><h2>الخبرة والمشاريع</h2><div class="data-grid">${rows([
      ["سنوات الخبرة", data.experience_years], ["أنواع المشاريع", data.project_types]
    ])}</div>${projectRows(data)}</section>

    <section><h2>الكادر والأنظمة</h2><div class="data-grid">${rows([
      ["إجمالي المهندسين", data.engineers_total], ["معماري", data.s_arch], ["إنشائي", data.s_struct],
      ["ميكانيكا", data.s_mech], ["كهرباء", data.s_elec], ["سلامة", data.s_fire], ["BIM", data.s_bim],
      ["تخصصات أخرى", data.s_other_staff], ["أعلى مؤهل", data.qualification], ["نظام جودة", data.has_qms],
      ["تفاصيل نظام الجودة", data.qms_detail], ["البرامج", data.software], ["عمل من الباطن", data.worked_sub],
      ["الالتزام بالجداول المتسارعة", data.schedule_cap], ["العمل ضمن فرق متعددة التخصصات", data.team_work]
    ])}</div></section>

    <section class="break-before"><h2>صور المشاريع</h2>${photoMarkup}</section>

    <section><h2>الإقرار</h2><div class="declaration">أقر مقدم الطلب بصحة ودقة جميع البيانات الواردة في هذه الاستمارة، ويتحمل المسؤولية عن صحتها.</div>
      <div class="data-grid">${rows([["الاسم",data.sign_name],["الصفة",data.sign_title],["التاريخ",data.sign_date]])}</div>
    </section>
    <footer><span>المنابر للاستشارات الهندسية</span><span>${esc(submission.reference)}</span></footer>
  </body></html>`;
}
