# ✅ الخطوات المتبقية لتشغيل المشروع

تم إكمال:
✅ قاعدة البيانات PostgreSQL + PostGIS
✅ Mapbox Token
✅ تثبيت Backend dependencies

---

## 🔥 الخطوات التالية (مهمة جداً!)

### الخطوة 1️⃣: إنشاء ملف .env للـ Backend

افتح مجلد `backend` وقم بما يلي:

1. **أنشئ ملف جديد** اسمه `.env` (بدون امتداد txt)
   - في VS Code: Right click → New File → اكتب `.env`
   - في Notepad: Save As → اكتب `.env` واختر "All Files"

2. **افتح ملف `CREATE_ENV_FILE.txt`** وانسخ محتواه كاملاً

3. **الصق المحتوى** في ملف `.env` الجديد

4. **احفظ الملف**

⚠️ **مهم**: تأكد من تعديل `DATABASE_URL` إذا كان:
   - اسم المستخدم ليس `postgres`
   - كلمة المرور ليست `postgres`

---

### الخطوة 2️⃣: تشغيل Database Migration

افتح **PowerShell** في مجلد المشروع واكتب:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd backend
npm run migrate
```

يجب أن تظهر رسائل مثل:
```
✅ PostGIS extension enabled
✅ Users table created
✅ Posts table created
...
✨ Database migration completed successfully!
```

---

### الخطوة 3️⃣: تشغيل Backend Server

ابقَ في نفس النافذة واكتب:

```powershell
npm run dev
```

يجب أن تظهر:
```
🚀 Server running on port 5000
📡 WebSocket server ready
✅ Connected to PostgreSQL database
```

⚠️ **لا تغلق هذه النافذة** - اتركها تعمل

---

### الخطوة 4️⃣: إعداد Frontend

افتح **نافذة PowerShell جديدة** واكتب:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\Moham\Desktop\APPAGQ\client"
npm install
```

انتظر حتى تنتهي التثبيت...

---

### الخطوة 5️⃣: إنشاء ملف .env.local للـ Frontend

1. افتح مجلد `client`
2. **أنشئ ملف جديد** اسمه `.env.local`
3. افتح `CREATE_ENV_FILE.txt` **وانسخ محتواه**
4. الصق في `.env.local` واحفظ

---

### الخطوة 6️⃣: تشغيل Frontend

في نفس نافذة Frontend اكتب:

```powershell
npm run dev
```

يجب أن تظهر:
```
➜ Local: http://localhost:5173/
```

---

### الخطوة 7️⃣: فتح التطبيق! 🎉

افتح المتصفح واذهب إلى: **http://localhost:5173**

---

## 🎊 الآن يمكنك:

1. **إنشاء حساب جديد**
2. **تسجيل الدخول**
3. **السماح بالوصول للموقع** (مهم للخريطة)
4. **استكشاف الخريطة**
5. **إنشاء منشور** مع صورة وموقع
6. **البحث عن مستخدمين** وإضافة أصدقاء
7. **المحادثة** مع الأصدقاء

---

## 🆘 إذا واجهت مشكلة

### مشكلة: Migration فشل
```powershell
# تأكد من أن PostgreSQL يعمل وأن PostGIS مثبت
psql -U postgres
CREATE EXTENSION postgis;
SELECT PostGIS_Version();
```

### مشكلة: Backend لا يعمل
- تحقق من ملف `.env` في مجلد backend
- تأكد من أن PostgreSQL يعمل على المنفذ 5432

### مشكلة: الخريطة لا تظهر
- تحقق من ملف `.env.local` في مجلد client
- تأكد من وجود `VITE_MAPBOX_TOKEN`

---

## ✅ Checklist النهائي

قبل التشغيل تأكد من:

- [ ] PostgreSQL يعمل
- [ ] PostGIS extension مُثبّت
- [ ] ملف `.env` موجود في `backend/`
- [ ] ملف `.env.local` موجود في `client/`
- [ ] Backend dependencies مثبتة (`npm install`)
- [ ] Migration تم بنجاح (`npm run migrate`)
- [ ] Backend Server يعمل (`npm run dev`)
- [ ] Frontend dependencies مثبتة (`npm install`)
- [ ] Frontend Server يعمل (`npm run dev`)

---

**بالتوفيق! استمتع بالمشروع** 🚀🎉
