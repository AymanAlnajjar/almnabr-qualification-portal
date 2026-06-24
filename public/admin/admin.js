const cfg = window.QUALIFICATION_CONFIG || {};
const $ = (selector) => document.querySelector(selector);
const loginView = $("#loginView");
const appView = $("#appView");
let currentSubmissionId = "";

if (!window.supabase?.createClient) {
  $("#loginError").textContent = "تعذر تحميل مكتبة تسجيل الدخول. يرجى تحديث الصفحة أو التواصل مع الدعم.";
  throw new Error("Supabase browser client is not loaded.");
}

if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
  $("#loginError").textContent = "إعدادات Supabase غير مكتملة في Netlify. تأكد من SUPABASE_URL و SUPABASE_ANON_KEY.";
  throw new Error("Missing public Supabase runtime configuration.");
}

const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

const statusLabels = {
  submitted: "جديد",
  under_review: "قيد المراجعة",
  qualified: "مؤهل",
  rejected: "مرفوض",
  archived: "مؤرشف"
};
const pdfLabels = { pending: "بانتظار الإنشاء", generating: "جارٍ الإنشاء", ready: "جاهز", failed: "فشل" };
const escapeHtml = (value) => String(value ?? "-").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}`, ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "تعذر إتمام العملية.");
  return body;
}

async function applySession() {
  const { data } = await supabase.auth.getSession();
  const signedIn = Boolean(data.session);
  loginView.hidden = signedIn;
  appView.hidden = !signedIn;
  if (signedIn) {
    try {
      await loadSubmissions();
      $("#loginError").textContent = "";
    } catch (error) {
      $("#loginError").textContent = error.message;
      await supabase.auth.signOut();
      loginView.hidden = false;
      appView.hidden = true;
    }
  }
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#loginError").textContent = "";
  const { error } = await supabase.auth.signInWithPassword({ email: $("#email").value, password: $("#password").value });
  if (error) $("#loginError").textContent = `تعذر تسجيل الدخول: ${error.message}`;
  else await applySession();
});

$("#logoutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); await applySession(); });
$("#refreshBtn").addEventListener("click", loadSubmissions);
$("#statusFilter").addEventListener("change", loadSubmissions);
let searchTimer;
$("#search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadSubmissions, 350); });

async function loadSubmissions() {
  const query = new URLSearchParams({ search: $("#search").value, status: $("#statusFilter").value });
  const result = await api(`admin-submissions?${query}`);
  $("#emptyState").hidden = result.items.length > 0;
  $("#submissionRows").innerHTML = result.items.map((item) => `<tr data-id="${item.id}">
    <td dir="ltr">${escapeHtml(item.reference)}</td>
    <td>${escapeHtml(item.office_name)}</td>
    <td>${new Date(item.submitted_at || item.created_at).toLocaleDateString("ar-EG")}</td>
    <td>${item.photo_count}</td>
    <td><span class="badge ${item.status}">${statusLabels[item.status] || item.status}</span></td>
    <td><span class="badge ${item.pdf_state}">${pdfLabels[item.pdf_state] || item.pdf_state}</span></td>
  </tr>`).join("");
  $("#submissionRows").querySelectorAll("tr").forEach((row) => row.addEventListener("click", () => openDetail(row.dataset.id)));
}

function detailRows(items) {
  return items.map(([label, value]) => `<div class="datum"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("");
}

function projectRows(data) {
  const rows = Array.from({ length: 5 }, (_, index) => {
    const n = index + 1;
    return [data[`p${n}_name`], data[`p${n}_loc`], data[`p${n}_year`], data[`p${n}_scope`]];
  }).filter((row) => row.some(Boolean));
  if (!rows.length) return "<p>لا توجد مشاريع مدخلة.</p>";
  return `<table class="detail-table"><thead><tr><th>#</th><th>المشروع</th><th>الموقع</th><th>السنة</th><th>النطاق</th></tr></thead><tbody>
    ${rows.map((row, index) => `<tr><td>${index + 1}</td>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
}

function photoCards(photos) {
  if (!photos.length) return "لا توجد صور";
  return photos.map((photo, index) => `<figure class="photo-card">
    <a href="${escapeHtml(photo.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.original_name)}"></a>
    <figcaption>
      <span>${index + 1}. ${escapeHtml(photo.original_name)}</span>
      <a class="download-link" href="${escapeHtml(photo.downloadUrl || photo.url)}" download>تنزيل الصورة</a>
    </figcaption>
  </figure>`).join("");
}

async function openDetail(id) {
  currentSubmissionId = id;
  const result = await api(`admin-submission?id=${encodeURIComponent(id)}`);
  const s = result.submission;
  const d = s.form_data || {};

  $("#detailContent").innerHTML = `<div class="detail">
    <h2>${escapeHtml(d.office_name)}</h2>
    <p dir="ltr">${escapeHtml(s.reference)}</p>
    <div class="detail-actions">
      ${result.pdfUrl ? `<a href="${escapeHtml(result.pdfUrl)}" download><button>تنزيل PDF</button></a>` : ""}
      <button id="regeneratePdf" class="secondary">إعادة إنشاء PDF</button>
      <select id="detailStatus">${Object.entries(statusLabels).map(([key, label]) => `<option value="${key}" ${s.status === key ? "selected" : ""}>${label}</option>`).join("")}</select>
      <button id="saveStatus" class="secondary">حفظ الحالة</button>
    </div>

    <h3>البيانات العامة للمكتب</h3>
    <div class="detail-grid">${detailRows([
      ["اسم المكتب", d.office_name], ["الدولة", d.country], ["المدينة", d.city], ["العنوان", d.address],
      ["الهاتف", d.phone], ["البريد الرسمي", d.email], ["الموقع الإلكتروني", d.website], ["سنة التأسيس", d.founded],
      ["الشكل القانوني", d.legal_form]
    ])}</div>

    <h3>ممثل المكتب</h3>
    <div class="detail-grid">${detailRows([
      ["الاسم", d.rep_name], ["المسمى الوظيفي", d.rep_title], ["الهاتف المباشر", d.rep_phone],
      ["البريد الإلكتروني", d.rep_email], ["مفوض بالتعاقد", d.authorized]
    ])}</div>

    <h3>التخصصات والخدمات</h3>
    <div class="detail-grid">${detailRows([
      ["التخصصات", d.specializations], ["تخصصات أخرى", d.spec_other], ["وصف الخدمات", d.services_desc]
    ])}</div>

    <h3>الخبرة والمشاريع</h3>
    <div class="detail-grid">${detailRows([
      ["سنوات الخبرة", d.experience_years], ["أنواع المشاريع", d.project_types]
    ])}</div>
    ${projectRows(d)}

    <h3>الكادر والأنظمة</h3>
    <div class="detail-grid">${detailRows([
      ["إجمالي المهندسين", d.engineers_total], ["معماري", d.s_arch], ["إنشائي", d.s_struct], ["ميكانيكا", d.s_mech],
      ["كهرباء", d.s_elec], ["سلامة", d.s_fire], ["BIM", d.s_bim], ["أخرى", d.s_other_staff],
      ["أعلى مؤهل", d.qualification], ["نظام جودة", d.has_qms], ["تفاصيل نظام الجودة", d.qms_detail],
      ["البرامج المستخدمة", d.software], ["عمل من الباطن", d.worked_sub],
      ["الالتزام بالجداول المتسارعة", d.schedule_cap], ["العمل ضمن فرق متعددة التخصصات", d.team_work]
    ])}</div>

    <h3>الإقرار والتوقيع</h3>
    <div class="detail-grid">${detailRows([
      ["الاسم", d.sign_name], ["الصفة / المسمى الوظيفي", d.sign_title], ["التاريخ", d.sign_date]
    ])}</div>

    <h3>الصور (${result.photos.length})</h3>
    <div class="photo-grid">${photoCards(result.photos)}</div>

    <h3>ملاحظات داخلية</h3>
    <div class="note-box"><textarea id="newNote" placeholder="أضف ملاحظة..."></textarea><button id="addNote">إضافة</button></div>
    <ul class="notes">${result.notes.map((note) => `<li>${escapeHtml(note.note)}<small> - ${new Date(note.created_at).toLocaleString("ar-EG")}</small></li>`).join("")}</ul>
  </div>`;
  $("#regeneratePdf").onclick = regeneratePdf;
  $("#saveStatus").onclick = saveStatus;
  $("#addNote").onclick = addNote;
  $("#detailDialog").showModal();
}

async function regeneratePdf(event) {
  event.target.disabled = true;
  try {
    await api("admin-regenerate-pdf", { method: "POST", body: JSON.stringify({ submissionId: currentSubmissionId }) });
    alert("تمت إضافة ملف PDF إلى قائمة الإنشاء. حدّث الصفحة بعد لحظات.");
  } finally {
    event.target.disabled = false;
  }
}

async function saveStatus() {
  await api("admin-update", { method: "PATCH", body: JSON.stringify({ submissionId: currentSubmissionId, status: $("#detailStatus").value }) });
  await loadSubmissions();
}

async function addNote() {
  const note = $("#newNote").value.trim();
  if (!note) return;
  await api("admin-update", { method: "PATCH", body: JSON.stringify({ submissionId: currentSubmissionId, note }) });
  await openDetail(currentSubmissionId);
}

$("#closeDialog").addEventListener("click", () => $("#detailDialog").close());

await applySession();
