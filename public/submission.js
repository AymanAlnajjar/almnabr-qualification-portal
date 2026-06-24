(function () {
  const config = window.QUALIFICATION_CONFIG || {};
  const MAX_PHOTOS = Number(config.maxPhotos || 5);
  const MAX_PHOTO_BYTES = Number(config.maxPhotoBytes || 5 * 1024 * 1024);

  function setButtonLoading(button, loading, text) {
    button.disabled = loading;
    button.setAttribute("aria-busy", String(loading));
    if (loading) button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = loading
      ? `<span class="submit-spinner" aria-hidden="true"></span>${text}`
      : button.dataset.originalHtml;
  }

  function showSubmitError(message) {
    let box = document.getElementById("submitError");
    if (!box) {
      box = document.createElement("div");
      box.id = "submitError";
      box.className = "submit-error";
      box.setAttribute("role", "alert");
      document.querySelector(".nav-bar").before(box);
    }
    box.textContent = message;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function uploadPhoto(upload, file) {
    const response = await fetch(upload.signedUrl, {
      method: "PUT",
      headers: { "content-type": file.type, "x-upsert": "false" },
      body: file
    });
    if (!response.ok) throw new Error(`PHOTO_UPLOAD_FAILED:${file.name}`);
  }

  window.getQualificationFiles = () => uploadedFiles.map((entry) => entry.file);

  window.submitForm = async function submitFormReliable() {
    if (!validateStep(5)) return;
    const button = document.getElementById("submitBtn");
    const errorBox = document.getElementById("submitError");
    if (errorBox) errorBox.hidden = true;

    try {
      const files = window.getQualificationFiles();
      if (files.length > MAX_PHOTOS) throw new Error("TOO_MANY_PHOTOS");
      if (files.some((file) => file.size > MAX_PHOTO_BYTES)) throw new Error("PHOTO_TOO_LARGE");

      setButtonLoading(button, true, "جارٍ حفظ الطلب...");
      const formData = collectData();
      delete formData.photos;
      delete formData.photos_count;

      const createResponse = await fetch("/api/create-submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: formData,
          photos: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
          honeypot: document.getElementById("companyWebsiteHp")?.value || ""
        })
      });
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created?.error?.message || "CREATE_FAILED");

      if (files.length) {
        setButtonLoading(button, true, `جارٍ رفع الصور (0/${files.length})...`);
        for (let index = 0; index < files.length; index += 1) {
          await uploadPhoto(created.uploads[index], files[index]);
          setButtonLoading(button, true, `جارٍ رفع الصور (${index + 1}/${files.length})...`);
        }
      }

      setButtonLoading(button, true, "جارٍ تأكيد الطلب...");
      const finalizeResponse = await fetch("/api/finalize-submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: created.submission.id })
      });
      const finalized = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalized?.error?.message || "FINALIZE_FAILED");

      document.getElementById("formWrap").style.display = "none";
      document.getElementById("success-screen").style.display = "block";
      document.querySelector("#success-screen h2").textContent = "تم استلام طلبكم بنجاح";
      const reference = document.createElement("p");
      reference.className = "submission-reference";
      reference.textContent = `رقم الطلب: ${finalized.submission.reference}`;
      document.querySelector(".success-card h2").after(reference);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      const messages = {
        TOO_MANY_PHOTOS: `يمكن رفع ${MAX_PHOTOS} صور كحد أقصى.`,
        PHOTO_TOO_LARGE: `حجم الصورة الواحدة يجب ألا يتجاوز ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} ميجابايت.`
      };
      showSubmitError(messages[error.message] || "لم يكتمل إرسال الطلب. لم يتم عرض رسالة نجاح، ويمكنكم المحاولة مرة أخرى.");
      setButtonLoading(button, false);
    }
  };
})();
