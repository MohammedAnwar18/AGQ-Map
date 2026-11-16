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
