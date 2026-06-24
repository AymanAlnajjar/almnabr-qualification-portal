const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const show = (value) => value === "" || value == null ? "-" : esc(value);

function fieldTable(items) {
  const cells = [];
  for (let index = 0; index < items.length; index += 2) {
    const first = items[index];
    const second = items[index + 1];
    cells.push(`<tr>
      <th>${esc(first[0])}</th><td>${show(first[1])}</td>
      ${second ? `<th>${esc(second[0])}</th><td>${show(second[1])}</td>` : '<th></th><td></td>'}
    </tr>`);
  }
  return `<table class="fields"><tbody>${cells.join("")}</tbody></table>`;
}

function paragraphField(label, value) {
  return `<div class="paragraph-field"><h3>${esc(label)}</h3><div>${show(value)}</div></div>`;
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
  return `<table class="projects">
    <thead><tr><th>#</th><th>اسم المشروع</th><th>المدينة / الدولة</th><th>السنة</th><th>نطاق العمل</th></tr></thead>
    <tbody>${projects.map((project, index) => `<tr>
      <td>${index + 1}</td>
      <td>${show(project.name)}</td>
      <td>${show(project.location)}</td>
      <td>${show(project.year)}</td>
      <td>${show(project.scope)}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

function photoMarkup(photos) {
  if (!photos.length) return '<p class="empty">لم يتم إرفاق صور.</p>';
  return `<div class="photo-grid">${photos.map((photo, index) => `<figure>
    <img src="${esc(photo.signedUrl)}" alt="صورة مشروع ${index + 1}">
    <figcaption>${index + 1}. ${esc(photo.original_name)}</figcaption>
  </figure>`).join("")}</div>`;
}

export function renderPdfHtml({ submission, photos, logoDataUrl, fontDataUrl = "" }) {
  const data = submission.form_data || {};
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<style>
${fontDataUrl ? `@font-face{font-family:PlexArabic;src:url(${fontDataUrl}) format('truetype');font-weight:100 900;}` : ""}
@page { size: A4; margin: 14mm 12mm 17mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  color: #152638;
  font-family: PlexArabic, Arial, sans-serif;
  font-size: 9.6pt;
  line-height: 1.55;
  background: #fff;
}
header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 3px solid #0f4c7a;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand img { width: 46px; height: 46px; object-fit: contain; }
.brand-name { color: #0f4c7a; font-weight: 800; font-size: 13pt; }
.brand-sub { color: #66788a; font-size: 8.4pt; }
.meta { text-align: left; direction: ltr; color: #66788a; font-size: 8.7pt; }
.meta strong { display: block; color: #0f4c7a; font-size: 14pt; direction: rtl; }
section { margin: 0 0 11px; break-inside: avoid; }
section.page { break-before: page; }
h2 {
  margin: 0 0 6px;
  color: #0f4c7a;
  font-size: 11.2pt;
  font-weight: 800;
}
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td {
  border: 1px solid #cfdae5;
  padding: 6px 8px;
  vertical-align: top;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
th {
  width: 18%;
  color: #5d6d7e;
  background: #f3f7fb;
  font-weight: 800;
}
td { width: 32%; color: #101820; background: #fff; }
.fields tr:nth-child(even) td { background: #fbfdff; }
.paragraph-field {
  border: 1px solid #cfdae5;
  margin-top: -1px;
  padding: 8px 10px;
  break-inside: avoid;
}
.paragraph-field h3 {
  margin: 0 0 4px;
  color: #5d6d7e;
  font-size: 9.6pt;
}
.paragraph-field div { white-space: pre-wrap; overflow-wrap: anywhere; }
.projects th, .projects td { text-align: right; }
.projects thead th {
  color: #0f4c7a;
  background: #eaf3fb;
  width: auto;
}
.staff-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid #cfdae5;
  border-bottom: 0;
}
.staff-item { display: grid; grid-template-columns: 1fr auto; border-bottom: 1px solid #cfdae5; }
.staff-item:nth-child(odd) { border-left: 1px solid #cfdae5; }
.staff-item b { padding: 6px 8px; background: #f3f7fb; color: #5d6d7e; }
.staff-item span { padding: 6px 8px; min-width: 36px; text-align: center; }
.photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
figure {
  margin: 0;
  border: 1px solid #cfdae5;
  border-radius: 7px;
  overflow: hidden;
  break-inside: avoid;
}
figure img { width: 100%; height: 175px; object-fit: contain; display: block; background: #f4f8fb; }
figcaption { padding: 5px 7px; color: #5d6d7e; font-size: 8.2pt; direction: ltr; text-align: right; }
.declaration {
  border: 1px solid #b9cee3;
  background: #f1f6fb;
  border-radius: 7px;
  padding: 9px 11px;
  margin-bottom: 7px;
}
.empty { color: #66788a; font-style: italic; }
footer {
  position: fixed;
  bottom: -10mm;
  right: 0;
  left: 0;
  border-top: 1px solid #cfdae5;
  padding-top: 4px;
  color: #7a8a9a;
  font-size: 8pt;
  display: flex;
  justify-content: space-between;
}
</style>
</head>
<body>
<header>
  <div class="brand">
    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="">` : ""}
    <div>
      <div class="brand-name">المنابر للاستشارات الهندسية</div>
      <div class="brand-sub">نموذج تأهيل مكتب هندسي</div>
    </div>
  </div>
  <div class="meta"><strong>طلب تأهيل</strong><span>${esc(submission.reference)}</span></div>
</header>

<section>
  <h2>البيانات العامة للمكتب</h2>
  ${fieldTable([
    ["اسم المكتب", data.office_name],
    ["الدولة", data.country],
    ["المدينة", data.city],
    ["العنوان", data.address],
    ["الهاتف", data.phone],
    ["البريد الرسمي", data.email],
    ["الموقع الإلكتروني", data.website],
    ["سنة التأسيس", data.founded],
    ["الشكل القانوني", data.legal_form]
  ])}
</section>

<section>
  <h2>ممثل المكتب</h2>
  ${fieldTable([
    ["الاسم", data.rep_name],
    ["المسمى الوظيفي", data.rep_title],
    ["الهاتف المباشر", data.rep_phone],
    ["البريد الإلكتروني", data.rep_email],
    ["مفوض بالتعاقد", data.authorized]
  ])}
</section>

<section>
  <h2>التخصصات والخدمات</h2>
  ${fieldTable([
    ["التخصصات", data.specializations],
    ["تخصصات أخرى", data.spec_other]
  ])}
  ${paragraphField("وصف الخدمات", data.services_desc)}
</section>

<section>
  <h2>الخبرة والمشاريع</h2>
  ${fieldTable([
    ["سنوات الخبرة", data.experience_years],
    ["أنواع المشاريع", data.project_types]
  ])}
  ${projectRows(data)}
</section>

<section>
  <h2>الكادر الهندسي</h2>
  ${fieldTable([["إجمالي المهندسين", data.engineers_total]])}
  <div class="staff-grid">
    ${[
      ["معماري", data.s_arch],
      ["إنشائي", data.s_struct],
      ["ميكانيكا", data.s_mech],
      ["كهرباء", data.s_elec],
      ["سلامة", data.s_fire],
      ["BIM", data.s_bim],
      ["أخرى", data.s_other_staff]
    ].map(([label, value]) => `<div class="staff-item"><b>${esc(label)}</b><span>${show(value)}</span></div>`).join("")}
  </div>
</section>

<section>
  <h2>الأنظمة والقدرات</h2>
  ${fieldTable([
    ["أعلى مؤهل", data.qualification],
    ["نظام جودة", data.has_qms],
    ["تفاصيل نظام الجودة", data.qms_detail],
    ["عمل من الباطن", data.worked_sub],
    ["الالتزام بالجداول المتسارعة", data.schedule_cap],
    ["العمل ضمن فرق متعددة التخصصات", data.team_work]
  ])}
  ${paragraphField("البرامج المستخدمة", data.software)}
</section>

<section class="page">
  <h2>الصور المرفقة (${photos.length})</h2>
  ${photoMarkup(photos)}
</section>

<section>
  <h2>الإقرار والتوقيع</h2>
  <div class="declaration">أقر مقدم الطلب بصحة ودقة جميع البيانات الواردة في هذه الاستمارة، ويتحمل المسؤولية عن صحتها، ويفوض شركة المنابر للاستشارات الهندسية بمراجعة هذه البيانات وطلب أي مستندات إضافية أو مقابلات فنية عند الحاجة.</div>
  ${fieldTable([
    ["الاسم", data.sign_name],
    ["الصفة / المسمى الوظيفي", data.sign_title],
    ["التاريخ", data.sign_date]
  ])}
</section>

<footer><span>المنابر للاستشارات الهندسية</span><span>${esc(submission.reference)}</span></footer>
</body>
</html>`;
}
