/* ============================================================================
   PalNovaa Engine — Subdomain Publisher + Edge Backend (Cloudflare Worker)
   ----------------------------------------------------------------------------
   يخدم كلّ تطبيقٍ منشورٍ على نطاقٍ فرعيٍّ خاصٍّ به:
       https://<slug>.palnovaa.com
   ويقدّم:
     • استضافةً متعدّدة الملفّات: أيّ مسار داخل R2 ‹apps/<slug>/…› (HTML/JS/CSS/أصول)
       مع تراجعٍ لـ index.html للمسارات بلا امتداد (توجيه من جهة العميل).
       — متوافقٌ رجعيّاً تماماً: تطبيقات الملفّ الواحد (index.html) تبقى تعمل كما هي.
     • خلفيّةً معزولةً لكلّ تطبيق على الحافّة عبر D1 تحت المسار ‹/__pn/data/…›،
       كلّ صفٍّ موسومٌ بالـslug فلا يصل تطبيقٌ لبيانات آخر إطلاقاً.

   أيّ نطاقٍ فرعيٍّ محجوز/غير صالح يُحوَّل للموقع الرئيسيّ. الجذر palnovaa.com
   لا يمرّ عبر هذا الـWorker. كلّ شيءٍ هنا إضافيّ ولا يمسّ تطبيق React/Vercel.
   ============================================================================ */

const RESERVED = new Set([
  'www', 'api', 'app', 'mail', 'cdn', 'ftp', 'blog', 'admin', 'status',
  'dashboard', 'foresight', 'assets', 'static', 'img', 'images', 'media',
  'docs', 'help', 'support', 'pe', 'apps', 'mx', 'ns', 'dev', 'staging',
]);

const SLUG_RE = /^[a-z0-9]{5,12}$/;
const API_PREFIX = '/__pn/';                 // مسارٌ محجوزٌ لخدمات المنصّة (لا يصطدم بملفّات التطبيق)
const NAME_RE = /^[A-Za-z0-9_-]{1,40}$/;     // اسم المجموعة (collection)
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;       // معرّف العنصر
const MAX_BODY = 100_000;                     // 100KB لكلّ عنصر
const MAX_LIMIT = 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const base = (env.APPS_BASE || 'palnovaa.com').toLowerCase();
    const home = `https://${base}${url.pathname}${url.search}`;

    // استخرج الـslug (أوّل مقطعٍ قبل نطاق الأساس)
    let slug = '';
    if (host.endsWith(`.${base}`)) slug = host.slice(0, host.length - base.length - 1).split('.').pop();
    slug = (slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');

    // ليس تطبيقاً (محجوز أو نمطٌ غير صالح) → حوّل للموقع الرئيسيّ
    if (!slug || RESERVED.has(slug) || !SLUG_RE.test(slug)) return Response.redirect(home, 302);

    // ===== خلفيّة التطبيق (API) =====
    if (url.pathname === '/__pn/health') {
      return json({ ok: true, slug, db: !!env.APP_DB });
    }
    if (url.pathname === API_PREFIX + 'data' || url.pathname.startsWith(API_PREFIX + 'data/')) {
      return handleData(request, env, slug, url);
    }

    // ===== استضافة الملفّات الثابتة (GET/HEAD فقط) =====
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    return serveStatic(request, env, slug, url);
  },
};

/* ------------------------- استضافة الملفّات ------------------------- */
async function serveStatic(request, env, slug, url) {
  // طبّع المسار: فكّ الترميز، امنع اجتياز المسار، وافتراضيّاً index.html
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { path = url.pathname; }
  path = path.replace(/^\/+/, '');
  if (path === '' || path.endsWith('/')) path += 'index.html';
  const parts = path.split('/').filter((s) => s && s !== '.');
  if (parts.some((s) => s === '..')) return notFound('مسارٌ غير صالح.');
  path = parts.join('/');

  const key = `apps/${slug}/${path}`;
  let obj = null;
  try { obj = await env.APPS_BUCKET.get(key); } catch { return notFound('تعذّر الوصول للتخزين.'); }

  // تراجع توجيه العميل: مسارٌ بلا امتداد غير موجود → قدّم index.html (SPA/صفحات افتراضيّة)
  if (!obj) {
    const hasExt = /\.[a-z0-9]{1,8}$/i.test(path);
    if (!hasExt) {
      try { obj = await env.APPS_BUCKET.get(`apps/${slug}/index.html`); } catch { /* */ }
      if (obj) path = 'index.html';
    }
  }
  if (!obj) return notFound('هذا الملفّ غير موجود أو لم يُنشَر بعد.');

  const headers = new Headers();
  headers.set('content-type', mimeFor(path));
  headers.set('cache-control', cacheFor(path));
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  if (obj.httpEtag) headers.set('etag', obj.httpEtag);
  // إن طابق الـETag رجّع 304
  const inm = request.headers.get('if-none-match');
  if (inm && obj.httpEtag && inm === obj.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}

function mimeFor(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  const M = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
    geojson: 'application/geo+json; charset=utf-8', csv: 'text/csv; charset=utf-8',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8',
    webmanifest: 'application/manifest+json', map: 'application/json',
    pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', wasm: 'application/wasm',
  };
  return M[ext] || 'application/octet-stream';
}
function cacheFor(path) {
  if (/\.(html?|json|geojson|csv)$/i.test(path)) return 'public, max-age=60';           // محتوى متغيّر
  if (/\.(js|mjs|css|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp4|webm|wasm)$/i.test(path)) return 'public, max-age=3600';
  return 'public, max-age=300';
}

/* ------------------------- خلفيّة البيانات (D1) ------------------------- */
let _schemaReady = false;
async function ensureSchema(db) {
  if (_schemaReady) return;
  await db.exec('CREATE TABLE IF NOT EXISTS items (app TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (app, collection, id));');
  _schemaReady = true;
}
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};
const rowToItem = (r) => { let d = {}; try { d = JSON.parse(r.data); } catch { /* */ } return { id: r.id, created: r.created, updated: r.updated, ...d }; };

async function handleData(request, env, slug, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.APP_DB) return json({ ok: false, reason: 'db_unavailable', hint: 'اربط قاعدة D1 باسم APP_DB في إعدادات الـWorker.' }, 503);

  const db = env.APP_DB;
  const rest = url.pathname.slice((API_PREFIX + 'data').length).replace(/^\/+/, ''); // "" | "col" | "col/id"
  const seg = rest ? rest.split('/') : [];
  const col = seg[0] || '';
  const id = seg[1] || '';

  try {
    await ensureSchema(db);

    // GET /__pn/data → قائمة المجموعات وأعدادها
    if (!col) {
      if (request.method !== 'GET') return json({ ok: false, reason: 'method' }, 405);
      const rs = await db.prepare('SELECT collection, COUNT(*) AS n FROM items WHERE app=? GROUP BY collection ORDER BY collection').bind(slug).all();
      const collections = (rs.results || []).map((r) => ({ name: r.collection, count: r.n }));
      return json({ ok: true, collections }, 200, true);
    }
    if (!NAME_RE.test(col)) return json({ ok: false, reason: 'bad_collection' }, 400);

    // مستوى المجموعة: /__pn/data/:col
    if (!id) {
      if (request.method === 'GET') {
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10) || 100));
        const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
        const rs = await db.prepare('SELECT id,data,created,updated FROM items WHERE app=? AND collection=? ORDER BY created DESC LIMIT ? OFFSET ?').bind(slug, col, limit, offset).all();
        const items = (rs.results || []).map(rowToItem);
        return json({ ok: true, items, limit, offset }, 200, true);
      }
      if (request.method === 'POST') {
        const body = await readJson(request); if (body.__err) return json({ ok: false, reason: body.__err }, 400);
        const docId = (typeof body.id === 'string' && ID_RE.test(body.id)) ? body.id : genId();
        const item = await upsert(db, slug, col, docId, body, false);
        return json({ ok: true, item }, 201, true);
      }
      if (request.method === 'DELETE' && url.searchParams.get('all') === '1') {
        await db.prepare('DELETE FROM items WHERE app=? AND collection=?').bind(slug, col).run();
        return json({ ok: true, cleared: true }, 200, true);
      }
      return json({ ok: false, reason: 'method' }, 405);
    }

    // مستوى العنصر: /__pn/data/:col/:id
    if (!ID_RE.test(id)) return json({ ok: false, reason: 'bad_id' }, 400);
    if (request.method === 'GET') {
      const r = await db.prepare('SELECT id,data,created,updated FROM items WHERE app=? AND collection=? AND id=?').bind(slug, col, id).first();
      if (!r) return json({ ok: false, reason: 'not_found' }, 404, true);
      return json({ ok: true, item: rowToItem(r) }, 200, true);
    }
    if (request.method === 'PUT' || request.method === 'PATCH') {
      const body = await readJson(request); if (body.__err) return json({ ok: false, reason: body.__err }, 400);
      const item = await upsert(db, slug, col, id, body, request.method === 'PATCH');
      return json({ ok: true, item }, 200, true);
    }
    if (request.method === 'DELETE') {
      await db.prepare('DELETE FROM items WHERE app=? AND collection=? AND id=?').bind(slug, col, id).run();
      return json({ ok: true }, 200, true);
    }
    return json({ ok: false, reason: 'method' }, 405);
  } catch (e) {
    return json({ ok: false, reason: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500, true);
  }
}

async function upsert(db, app, col, id, body, merge) {
  const now = Date.now();
  const clean = { ...body }; delete clean.id; delete clean.created; delete clean.updated;
  if (merge) {
    const prev = await db.prepare('SELECT data,created FROM items WHERE app=? AND collection=? AND id=?').bind(app, col, id).first();
    let base = {}; if (prev) { try { base = JSON.parse(prev.data); } catch { /* */ } }
    const data = JSON.stringify({ ...base, ...clean });
    const created = prev ? prev.created : now;
    await db.prepare('INSERT INTO items (app,collection,id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(app,collection,id) DO UPDATE SET data=excluded.data, updated=excluded.updated').bind(app, col, id, data, created, now).run();
    return { id, created, updated: now, ...JSON.parse(data) };
  }
  const data = JSON.stringify(clean);
  const prev = await db.prepare('SELECT created FROM items WHERE app=? AND collection=? AND id=?').bind(app, col, id).first();
  const created = prev ? prev.created : now;
  await db.prepare('INSERT INTO items (app,collection,id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(app,collection,id) DO UPDATE SET data=excluded.data, updated=excluded.updated').bind(app, col, id, data, created, now).run();
  return { id, created, updated: now, ...clean };
}

async function readJson(request) {
  const len = parseInt(request.headers.get('content-length') || '0', 10);
  if (len > MAX_BODY) return { __err: 'too_large' };
  let txt; try { txt = await request.text(); } catch { return { __err: 'read' }; }
  if (txt.length > MAX_BODY) return { __err: 'too_large' };
  if (!txt) return {};
  try { const o = JSON.parse(txt); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : { __err: 'not_object' }; }
  catch { return { __err: 'bad_json' }; }
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function json(obj, status = 200, cors = false) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (cors) Object.assign(headers, CORS);
  return new Response(JSON.stringify(obj), { status, headers });
}

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
