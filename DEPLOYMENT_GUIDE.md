# 🚀 دليل نشر تطبيق الشبكة الاجتماعية المكانية (Spatial Social Network)

هذا الدليل يشرح كيفية نشر التطبيق بالكامل ليصبح متاحاً للجميع على الإنترنت.

## 📦 المتطلبات
- حساب على [GitHub](https://github.com)
- حساب على [Render](https://render.com) (للخلفية وقاعدة البيانات)
- حساب على [Vercel](https://vercel.com) (للواجهة الأمامية)

---

## 1️⃣ الخطوة الأولى: رفع الكود على GitHub

1. اذهب إلى GitHub وأنشئ **New Repository** (سمّه مثلاً `spatial-social-app`).
2. لا تضف `README` أو `.gitignore` (لديك بالفعل).
3. افتح التيرمينال في مجلد مشروعك ونفذ الأوامر التالية:

```bash
git init
git add .
git commit -m "Initial commit - Full App"
git branch -M main
git remote add origin https://github.com/USERNAME/spatial-social-app.git
git push -u origin main
```
*(استبدل `USERNAME` باسم مستخدمك في GitHub)*

---

## 2️⃣ الخطوة الثانية: إعداد قاعدة البيانات والخلفية (Render)

موقع **Render** ممتاز لأنه يدعم Node.js و PostgreSQL في مكان واحد.

### أ. إنشاء قاعدة البيانات (PostgreSQL)
1. في لوحة تحكم Render، اضغط **New +** واختر **PostgreSQL**.
2. الاسم: `spatial-db`.
3. المنطقة: اختر الأقرب لك (مثلاً `Frankfurt`).
4. الخطة: **Free**.
5. بعد الإنشاء، انسخ **Internal Database URL** و **External Database URL**.

### ب. نشر الخلفية (Backend Web Service)
1. اضغط **New +** واختر **Web Service**.
2. اربط حساب GitHub واختر المستودع `spatial-social-app`.
3. الإعدادات:
   - **Name:** `spatial-backend`
   - **Region:** نفس منطقة قاعدة البيانات.
   - **Root Directory:** `backend` (مهم جداً!)
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free.

4. **Environment Variables (متغيرات البيئة):**
   اضغط على **Advanced** وأضف المتغيرات التالية (انسخها من ملف `.env` لديك):
   - `PORT`: `10000` (Render يستخدم هذا المنفذ غالباً)
   - `DATABASE_URL`: (الصق **Internal Database URL** الذي نسخته من الخطوة أ)
   - `JWT_SECRET`: (أي نص طويل وسري)
   - `MAPBOX_TOKEN`: (التوكن الخاص بك)
   - `CLIENT_URL`: (اتركه فارغاً الآن سنعود له بعد نشر الـ Frontend)

5. اضغط **Create Web Service**.

### ج. تهيئة قاعدة البيانات
بما أن قاعدة البيانات جديدة، تحتاج لإنشاء الجداول.
1. في Render، اذهب لصفحة الـ Backend.
2. اختر **Shell** (تيرمينال داخل المتصفح).
3. اكتب الأمر: `npm run migrate` (تأكدنا سابقاً أن هذا الأمر ينشئ الجداول).

---

## 3️⃣ الخطوة الثالثة: نشر الواجهة الأمامية (Vercel)

موقع **Vercel** هو الأفضل لتطبيقات React/Vite.

1. اذهب إلى Vercel واضغط **Add New Project**.
2. اختر المستودع `spatial-social-app`.
3. في **Framework Preset**، سيختار `Vite` تلقائياً.
4. **Root Directory:** اضغط Edit واختر مجلد `client`.
5. **Environment Variables:**
   أضف المتغيرات التالية:
   - `VITE_API_URL`: (رابط الـ Backend من Render، مثلاً `https://spatial-backend.onrender.com/api`)
   - `VITE_WS_URL`: (رابط الـ Backend من Render بدون `/api`، مثلاً `https://spatial-backend.onrender.com`)
   - `VITE_MAPBOX_TOKEN`: (التوكن الخاص بك)

6. اضغط **Deploy**.

---

## 4️⃣ الخطوة الأخيرة: الربط النهائي

1. بعد نجاح نشر الـ Frontend على Vercel، انسخ الرابط (مثلاً `https://spatial-app.vercel.app`).
2. عد إلى **Render (Backend)** > **Environment Variables**.
3. عدّل قيمة `CLIENT_URL` وضع رابط Vercel هناك.
4. احفظ التغييرات (سيعيد Render تشغيل السيرفر تلقائياً).

---

## 🎉 مبروك! تطبيقك يعمل الآن أونلاين!
يمكنك مشاركة رابط Vercel مع أي شخص في العالم.
