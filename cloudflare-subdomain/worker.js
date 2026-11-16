/* ============================================================================
   PalNovaa Engine — Subdomain Publisher (Cloudflare Worker)
   ----------------------------------------------------------------------------
   يخدم كلّ تطبيقٍ منشورٍ على نطاقٍ فرعيٍّ لكلّ مشروع:
       https://<slug>.palnovaa.com          (APPS_BASE = palnovaa.com)
   قارئاً الملفّ مباشرةً من نفس حاوية R2 (apps/<slug>/index.html).

   أيّ نطاقٍ فرعيٍّ ليس تطبيقاً (www, api, … أو مكتوبٌ خطأً) يُحوَّل للموقع الرئيسيّ،
   فلا يتأثّر أيّ شيءٍ قائم. الجذر palnovaa.com لا يمرّ عبر هذا الـWorker أصلاً.
   ============================================================================ */

const RESERVED = new Set([
  'www', 'api', 'app', 'mail', 'cdn', 'ftp', 'blog', 'admin', 'status',
  'dashboard', 'foresight', 'assets', 'static', 'img', 'images', 'media',
  'docs', 'help', 'support', 'pe', 'apps', 'mx', 'ns', 'dev', 'staging',
]);

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const base = (env.APPS_BASE || 'palnovaa.com').toLowerCase();
    const home = `https://${base}${url.pathname}${url.search}`;

    // استخرج الـslug (أوّل مقطعٍ قبل نطاق الأساس)
    let slug = '';
    if (host.endsWith(`.${base}`)) {
      slug = host.slice(0, host.length - base.length - 1).split('.').pop();
    }
    slug = (slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');

    // ليس تطبيقاً (محجوز أو نمطٌ غير صالح) → حوّل للموقع الرئيسيّ
    if (!slug || RESERVED.has(slug) || !/^[a-z0-9]{5,12}$/.test(slug)) {
      return Response.redirect(home, 302);
    }

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

function notFound(msg) {
  return new Response(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>غير موجود</title></head>` +
    `<body style="font-family:system-ui,'Segoe UI',sans-serif;background:#0A0B0D;color:#C8CDD4;display:grid;place-items:center;min-height:100vh;margin:0">` +
    `<div style="text-align:center;padding:24px"><h1 style="color:#E07B39;font-size:46px;margin:0">٤٠٤</h1>` +
    `<p style="opacity:.8">${msg || 'الصفحة غير موجودة.'}</p>` +
    `<p><a href="https://palnovaa.com" style="color:#E07B39">العودة للموقع</a></p></div></body></html>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}
