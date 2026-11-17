# نشر تطبيقات المحرّك على نطاقٍ فرعيّ (`<slug>.apps.palnovaa.com`)

Written for: صاحب المشروع (إعدادٌ لمرّةٍ واحدة على Cloudflare).

يخدم هذا الـWorker كلّ تطبيقٍ منشورٍ على نطاقٍ فرعيٍّ خاصّ به، قارئاً الملفّ مباشرةً
من نفس حاوية R2 التي ينشر إليها المحرّك (`apps/<slug>/index.html`). بلا خادمٍ وسيط
وبلا تكلفة خروج، ومعزولٌ أمنيّاً (كلّ تطبيقٍ على أصلٍ مستقلّ).

## لماذا Worker على Cloudflare؟
أنت أصلاً على Cloudflare (DNS + R2). الـWorker يربط الحاوية مباشرةً — أنظف وأأمن من
تمرير النطاقات الفرعيّة عبر Vercel، ويحافظ على عزل التطبيقات عن الموقع الرئيسيّ.

## الخطوات (مرّةً واحدة)

### 1) DNS
في Cloudflare → DNS، أضِف سجلّاً عامّاً (wildcard) **مُفعّل البروكسي (سحابة برتقاليّة)**:
```
Type: CNAME   Name: *.apps   Target: palnovaa.com   Proxy: ✅ (Proxied)
```
فيصبح `<أيّ>.apps.palnovaa.com` يمرّ عبر Cloudflare.

### 2) الـWorker
1. عدّل `wrangler.toml`: ضع `bucket_name` = اسم حاوية R2 نفسها (قيمة `R2_BUCKET_NAME` في Vercel).
2. انشر:
   ```bash
   npm i -g wrangler
   wrangler login
   cd cloudflare-subdomain
   wrangler deploy
   ```
   (أو انسخ محتوى `worker.js` يدويّاً في Dashboard → Workers & Pages → Create Worker، ثمّ من Settings → Variables اربط **R2 bucket binding** باسم `APPS_BUCKET`، وأضِف متغيّر `APPS_BASE=apps.palnovaa.com`.)

### 3) الربط بالمسار
Cloudflare Dashboard → Workers & Pages → الـWorker → **Triggers/Routes** → Add route:
```
*.apps.palnovaa.com/*     (Zone: palnovaa.com)
```

### 4) جرّب
انشر تطبيقاً من المحرّك (slug مثلاً `abc1234`) ثمّ افتح:
```
https://abc1234.apps.palnovaa.com
```

## ملاحظة أمنيّة
- كلّ تطبيقٍ على أصلٍ (origin) مستقلٍّ حسب الـslug؛ وجلسة المحرّك محفوظةٌ في
  `localStorage` (مرتبطٌ بالأصل) فلا تصل التطبيقات لجلسة الموقع الرئيسيّ.
- للعزل الأقصى (مطابقةً لنموذج R2 الحاليّ) يمكن استضافة التطبيقات على **نطاقٍ منفصلٍ
  تماماً** (مثل `*.palnovaa-apps.com`) بدل `*.apps.palnovaa.com` — نفس الـWorker، فقط
  غيّر `APPS_BASE` والنطاق. ويُنصَح بعدم ربط أيّ كوكيز حسّاسة بنطاق `.palnovaa.com`.

## الخطوة التالية (اختياريّة، في المحرّك)
بعد تأكيد عمل الـWorker، نضبط متغيّر `PALNOVAA_APPS_BASE=apps.palnovaa.com` في الخادم،
فيعرض زرّ «مشاركة» رابط النطاق الفرعيّ الأنيق بدل `/pe/<slug>` (نُفعّلها حين تجهز البنية
حتى لا تظهر روابطٌ مكسورة قبل ذلك).

---

# تحديث: استضافة متعدّدة الملفّات + خلفيّة لكلّ تطبيق (D1)

هذا الإصدار من `worker.js` يضيف قدرتين — **كلاهما إضافيّ ومتوافقٌ رجعيّاً**: تطبيقات الملفّ
الواحد الحاليّة (`index.html`) تبقى تعمل تماماً بلا أيّ تغيير.

## 1) استضافة متعدّدة الملفّات (تلقائيّة، بلا إعداد)
يقدّم الـWorker الآن **أيّ مسار** داخل `apps/<slug>/…` من R2 بنوع MIME الصحيح:
```
apps/<slug>/index.html · pages/*.html · js/*.js (ESM) · css/*.css · assets/* · data/*.geojson …
```
- المسار الفارغ أو المنتهي بـ`/` → `index.html`.
- مسارٌ **بلا امتداد** غير موجود → يُقدَّم `index.html` (توجيهٌ من جهة العميل / صفحات افتراضيّة).
- حمايةٌ من اجتياز المسار (`..`)، وترويسات تخزينٍ مؤقّت حسب نوع الملفّ، ودعم `ETag/304`.
- لا حاجة لأيّ خطوة بناء (build): المتصفّح يشغّل وحدات ESM ويربطها مباشرةً.

## 2) خلفيّة معزولة لكلّ تطبيق عبر D1
كلّ تطبيقٍ يحصل على مخزن بياناتٍ خاصٍّ به تحت `https://<slug>.palnovaa.com/__pn/data/…`،
وكلّ صفٍّ موسومٌ بالـslug في قاعدة D1 واحدة → **لا يصل تطبيقٌ لبيانات آخر إطلاقاً**
(عزلٌ منطقيّ، ضمن حدود الحساب، وضمن الطبقة المجّانيّة السخيّة لـD1).

### الإعداد (مرّةً واحدة)
```bash
cd cloudflare-subdomain
npx wrangler d1 create palnovaa-app-db          # انسخ database_id الناتج
# ضعه في wrangler.toml تحت [[d1_databases]] (binding = "APP_DB")
npx wrangler deploy
```
الجدول يُنشَأ تلقائيّاً عند أوّل كتابة (`CREATE TABLE IF NOT EXISTS`). أو من اللوحة:
Workers & Pages → الـWorker → Settings → Bindings → **D1 database** باسم `APP_DB`.
إن لم تُربَط القاعدة، يردّ الـAPI بـ`503 db_unavailable` بوضوح ولا ينهار شيء.

### واجهة البيانات (REST بسيط، JSON)
«المجموعة» (collection) ≈ جدول، و«العنصر» ≈ صفّ (وثيقة JSON) بمعرّف `id`.
| الطريقة | المسار | الوظيفة |
|---|---|---|
| GET | `/__pn/data` | قائمة المجموعات وأعدادها |
| GET | `/__pn/data/:col?limit=&offset=` | عناصر المجموعة (الأحدث أولاً) |
| POST | `/__pn/data/:col` | إنشاء عنصر (JSON؛ `id` اختياريّ) |
| GET | `/__pn/data/:col/:id` | عنصرٌ واحد |
| PUT | `/__pn/data/:col/:id` | استبدال العنصر |
| PATCH | `/__pn/data/:col/:id` | دمج حقول |
| DELETE | `/__pn/data/:col/:id` | حذف عنصر |
| GET | `/__pn/health` | فحصٌ سريع (هل القاعدة مربوطة؟) |

حدود أمان: جسمٌ ≤100KB للعنصر، أسماء/معرّفات مُتحقّق منها، استعلامات مُعدّة (لا حقن SQL)،
و`CORS` مفتوحٌ للقراءة/الكتابة (التطبيق نفسه على نفس الأصل فلا يحتاجه أصلاً).

> مثال من داخل تطبيقٍ مولَّد:
> ```js
> await fetch('/__pn/data/tasks', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ title:'مهمّة', done:false }) });
> const { items } = await (await fetch('/__pn/data/tasks')).json();
> ```
