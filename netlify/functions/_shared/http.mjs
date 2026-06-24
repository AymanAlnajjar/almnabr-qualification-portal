const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization, x-internal-secret",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS"
};

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...extraHeaders
    }
  });
}

export function preflight(request) {
  return request.method === "OPTIONS" ? json(204, {}) : null;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "تعذر قراءة بيانات الطلب.");
  }
}

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json(error.status, {
      ok: false,
      error: { code: error.code, message: error.message, details: error.details }
    });
  }

  console.error(error);
  return json(500, {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى." }
  });
}
