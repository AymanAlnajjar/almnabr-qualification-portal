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

const statusLabels = { submitted:"جديد",under_review:"قيد المراجعة",qualified:"مؤهل",rejected:"مرفوض",archived:"مؤرشف" };
const pdfLabels = { pending:"بانتظار الإنشاء",generating:"جارٍ الإنشاء",ready:"جاهز",failed:"فشل" };
const escapeHtml = (value) => String(value ?? "-").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: { "content-type":"application/json", authorization:`Bearer ${await token()}`, ...(options.headers || {}) }
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
    <td dir="ltr">${escapeHtml(item.reference)}</td><td>${escapeHtml(item.office_name)}</td>
    <td>${new Date(item.submitted_at || item.created_at).toLocaleDateString("ar-EG")}</td><td>${item.photo_count}</td>
    <td><span class="badge ${item.status}">${statusLabels[item.status] || item.status}</span></td>
    <td><span class="badge ${item.pdf_state}">${pdfLabels[item.pdf_state] || item.pdf_state}</span></td></tr>`).join("");
  $("#submissionRows").querySelectorAll("tr").forEach((row) => row.addEventListener("click", () => openDetail(row.dataset.id)));
}

async function openDetail(id) {
  currentSubmissionId = id;
  const result = await api(`admin-submission?id=${encodeURIComponent(id)}`);
  const s = result.submission, d = s.form_data;
  const fields = [["اسم المكتب",d.office_name],["الدولة",d.country],["المدينة",d.city],["الهاتف",d.phone],["البريد",d.email],["ممثل المكتب",d.rep_name],["هاتف الممثل",d.rep_phone],["بريد الممثل",d.rep_email],["التخصصات",d.specializations],["الخدمات",d.services_desc],["سنوات الخبرة",d.experience_years],["إجمالي المهندسين",d.engineers_total],["البرامج",d.software]];
  $("#detailContent").innerHTML = `<div class="detail"><h2>${escapeHtml(d.office_name)}</h2><p dir="ltr">${escapeHtml(s.reference)}</p>
    <div class="detail-actions">
      ${result.pdfUrl ? `<a href="${escapeHtml(result.pdfUrl)}"><button>تنزيل PDF</button></a>` : ""}
      <button id="regeneratePdf" class="secondary">إعادة إنشاء PDF</button>
      <select id="detailStatus">${Object.entries(statusLabels).map(([key,label])=>`<option value="${key}" ${s.status===key?"selected":""}>${label}</option>`).join("")}</select>
      <button id="saveStatus" class="secondary">حفظ الحالة</button>
    </div>
    <div class="detail-grid">${fields.map(([label,value])=>`<div class="datum"><b>${label}</b><span>${escapeHtml(value)}</span></div>`).join("")}</div>
    <h3>الصور (${result.photos.length})</h3><div class="photo-grid">${result.photos.map(p=>`<a href="${escapeHtml(p.url)}" target="_blank"><img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.original_name)}"></a>`).join("") || "لا توجد صور"}</div>
    <h3>ملاحظات داخلية</h3><div class="note-box"><textarea id="newNote" placeholder="أضف ملاحظة..."></textarea><button id="addNote">إضافة</button></div>
    <ul class="notes">${result.notes.map(n=>`<li>${escapeHtml(n.note)}<small> - ${new Date(n.created_at).toLocaleString("ar-EG")}</small></li>`).join("")}</ul></div>`;
  $("#regeneratePdf").onclick = regeneratePdf;
  $("#saveStatus").onclick = saveStatus;
  $("#addNote").onclick = addNote;
  $("#detailDialog").showModal();
}

async function regeneratePdf(event) {
  event.target.disabled = true;
  try { await api("admin-regenerate-pdf",{method:"POST",body:JSON.stringify({submissionId:currentSubmissionId})}); alert("تمت إضافة ملف PDF إلى قائمة الإنشاء."); }
  finally { event.target.disabled = false; }
}
async function saveStatus() { await api("admin-update",{method:"PATCH",body:JSON.stringify({submissionId:currentSubmissionId,status:$("#detailStatus").value})}); await loadSubmissions(); }
async function addNote() { const note=$("#newNote").value.trim(); if(!note)return; await api("admin-update",{method:"PATCH",body:JSON.stringify({submissionId:currentSubmissionId,note})}); await openDetail(currentSubmissionId); }
$("#closeDialog").addEventListener("click",()=>$("#detailDialog").close());

await applySession();
