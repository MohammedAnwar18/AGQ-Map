/* ============================================================================
   PalNovaa Engine — Subdomain Publisher (Cloudflare Worker)
   ----------------------------------------------------------------------------
   يخدم التطبيقات المنشورة على نطاقٍ فرعيٍّ لكلّ مشروع:
       https://<slug>.apps.palnovaa.com
   يقرأ الملفّ مباشرةً من نفس حاوية R2 التي ينشر إليها المحرّك
   (المفتاح: apps/<slug>/index.html) — بلا خادمٍ وسيط وبلا تكلفة خروج.

   الأمان: كلّ تطبيقٍ على أصلٍ (origin) مستقلٍّ حسب الـslug، وتخزين الجلسة في
   المحرّك عبر localStorage (مرتبطٌ بالأصل) فلا تصل التطبيقات لجلسة الموقع الرئيسيّ.
   ============================================================================ */

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const base = (env.APPS_BASE || 'apps.palnovaa.com').toLowerCase();

    // استخرج الـslug: أوّل مقطعٍ قبل نطاق الأساس
    let slug = '';
    if (host === base || host === `www.${base}`) {
      return landing(base);                      // زيارة الأساس نفسه
    }
    if (host.endsWith(`.${base}`)) {
      slug = host.slice(0, host.length - base.length - 1).split('.').pop();
    }
    slug = (slug || '').replace(/[^a-z0-9-]/gi, '');  // تعقيمٌ صارم
    if (!slug) return notFound('رابطٌ غير صالح.');

    const key = `apps/${slug}/index.html`;
    let obj;
    try { obj = await env.APPS_BUCKET.get(key); }
    catch { return notFound('تعذّر الوصول للتخزين.'); }
    if (!obj) return notFound('هذا التطبيق غير موجود أو لم يُنشَر بعد.');

    const headers = new Headers();
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'public, max-age=60');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'no-referrer');
    if (obj.httpEtag) headers.set('etag', obj.httpEtag);
    return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
  },
};

function page(title, bodyHtml, status) {
  return new Response(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
    `<body style="font-family:system-ui,'Segoe UI',sans-serif;background:#0A0B0D;color:#C8CDD4;display:grid;place-items:center;min-height:100vh;margin:0">` +
    `<div style="text-align:center;padding:24px">${bodyHtml}</div></body></html>`,
    { status: status || 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}
function notFound(msg) {
  return page('غير موجود', `<h1 style="color:#E07B39;font-size:46px;margin:0">٤٠٤</h1><p style="opacity:.8">${msg || 'الصفحة غير موجودة.'}</p>`, 404);
}
function landing(base) {
  return page('PalNovaa Engine — التطبيقات',
    `<h1 style="color:#E07B39">PalNovaa Engine</h1><p style="opacity:.8">تُنشَر تطبيقات المستخدمين على نطاقٍ فرعيٍّ خاصّ: <code>&lt;اسم-المشروع&gt;.${base}</code></p>`);
}
