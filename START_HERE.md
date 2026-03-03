# 🗺️ Spatial Social Network - جاهز للتشغيل!

## ✅ ما تم إنجازه:

- ✅ **Backend كامل** - 21 ملف (PostgreSQL + PostGIS + Socket.IO)
- ✅ **Frontend كامل** - 15 ملف (React + Mapbox)
- ✅ **Dependencies مثبتة** - Backend (168 حزمة) + Frontend (130 حزمة)
- ✅ **Mapbox Token** - مُضاف ويعمل
- ✅ **ملفات .env** - جاهزة

---

## ⚠️ خطوة واحدة قبل التشغيل!

### تحديث كلمة مرور PostgreSQL:

**افتح ملف**: `backend\.env`

**ابحث عن**:
```env
DATABASE_URL=postgresql://postgres:root@localhost:5432/spatial_social_network
```

**غيّر `root`** إلى كلمة مرور PostgreSQL الصحيحة عندك.

**أمثلة**:
```env
# إذا كانت كلمة المرور admin
DATABASE_URL=postgresql://postgres:admin@localhost:5432/spatial_social_network

# إذا كانت كلمة المرور postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spatial_social_network

# إذا كانت كلمة المرور 12345
DATABASE_URL=postgresql://postgres:12345@localhost:5432/spatial_social_network
```

**احفظ الملف** ✅

---

## 🚀 التشغيل (3 خطوات):

### 1️⃣ شغّل Backend

افتح **PowerShell** واكتب:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\Moham\Desktop\APPAGQ\backend"
node migrations/init.js
npm run dev
```

✅ **يجب أن تشاهد**: `🚀 Server running on port 5000`

**لا تغلق هذه النافذة!**

---

### 2️⃣ شغّل Frontend

افتح **نافذة PowerShell جديدة** واكتب:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\Moham\Desktop\APPAGQ\client"
npm run dev
```

✅ **يجب أن تشاهد**: `➜ Local: http://localhost:5173/`

---

### 3️⃣ افتح التطبيق

**افتح المتصفح** واذهب إلى:

```
http://localhost:5173
```

---

## 🎉 استمتع!

### يمكنك الآن:

- 🔐 **إنشاء حساب** وتسجيل دخول
- 🗺️ **استكشاف الخريطة** التفاعلية
- 📸 **إنشاء منشور** مع صورة + GPS
- 👥 **البحث عن مستخدمين** وإضافة أصدقاء
- 💬 **الدردشة** الفورية مع الأصدقاء
- 📍 **رؤية منشورات الأصدقاء** على الخريطة

---

## 📚 ملفات مساعدة:

- **`READ_ME_FIRST.md`** - تفاصيل تحديث كلمة المرور
- **`RUN_COMMANDS.ps1`** - أوامر التشغيل
- **`SETUP.md`** - دليل كامل
- **`PROJECT_SUMMARY.md`** - تفاصيل المشروع

---

## 🆘 مشاكل شائعة:

### Migration فشل؟
→ تحقق من كلمة مرور PostgreSQL في `.env`

### الخريطة لا تظهر؟
→ تحقق من `VITE_MAPBOX_TOKEN` في `client\.env.local`

### Backend لا يعمل؟
→ تأكد من أن PostgreSQL يعمل

---

**المشروع جاهز 99%!** فقط حدّث كلمة المرور وشغّل 🚀
