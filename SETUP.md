# 🚀 دليل الإعداد السريع - Spatial Social Network

## المتطلبات الأساسية

قبل البدء، تأكد من تثبيت:

1. **Node.js** (v18 أو أحدث) - [تحميل](https://nodejs.org/)
2. **PostgreSQL** (v14 أو أحدث) مع **PostGIS** - [تحميل](https://www.postgresql.org/download/)
3. **Mapbox Token** - [احصل على حساب مجاني](https://www.mapbox.com/)

---

## خطوة 1: إعداد قاعدة البيانات PostgreSQL + PostGIS

### تشغيل PostgreSQL Command Line

```sql
-- افتح psql أو pgAdmin واكتب:

-- 1. إنشاء قاعدة البيانات
CREATE DATABASE spatial_social_network;

-- 2. الاتصال بقاعدة البيانات
\c spatial_social_network

-- 3. تفعيل PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 4. التحقق من التثبيت
SELECT PostGIS_Version();
```

✅ إذا ظهرت معلومات PostGIS، فالإعداد ناجح!

---

## خطوة 2: إعداد Backend

### 1. الانتقال لمجلد Backend
```bash
cd backend
```

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. إنشاء ملف .env

قم بنسخ المحتوى التالي إلى ملف جديد اسمه `.env` في مجلد `backend`:

```env
PORT=5000
NODE_ENV=development

# قم بتعديل اسم المستخدم وكلمة المرور حسب إعدادات PostgreSQL لديك
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spatial_social_network

JWT_SECRET=spatial_social_network_secret_key_2024_change_in_production

# ضع Mapbox Token هنا (احصل عليه من mapbox.com)
MAPBOX_TOKEN=YOUR_MAPBOX_TOKEN_HERE

CLIENT_URL=http://localhost:5173
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

⚠️ **مهم جداً**: 
- غيّر `postgres:postgres` إلى اسم المستخدم وكلمة المرور الخاصة بـ PostgreSQL
- ضع Mapbox Access Token الخاص بك

### 4. تشغيل Database Migration
```bash
npm run migrate
```

إذا نجح، ستظهر رسائل مثل:
```
✅ PostGIS extension enabled
✅ Users table created
✅ Posts table created
...
```

### 5. تشغيل Backend Server
```bash
npm run dev
```

✅ يجب أن تظهر:
```
🚀 Server running on port 5000
📡 WebSocket server ready
✅ Connected to PostgreSQL database
```

---

## خطوة 3: إعداد Frontend

### افتح نافذة Terminal جديدة

### 1. الانتقال لمجلد Client
```bash
cd client
```

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. تعديل ملف .env.local

افتح ملف `client/.env.local` وضع Mapbox Token الخاص بك:

```env
VITE_API_URL=/api
VITE_WS_URL=http://localhost:5000
VITE_MAPBOX_TOKEN=YOUR_MAPBOX_TOKEN_HERE
```

### 4. تشغيل Frontend
```bash
npm run dev
```

✅ يجب أن تظهر:
```
  ➜  Local:   http://localhost:5173/
```

---

## خطوة 4: فتح التطبيق

افتح المتصفح واذهب إلى: **http://localhost:5173**

---

## 🎉 الاستخدام

### تسجيل مستخدم جديد
1. اضغط على "إنشاء حساب جديد"
2. املأ البيانات (اسم المستخدم، البريد، كلمة المرور)
3. اضغط "إنشاء الحساب"

### تصاريح الموقع
- عند الدخول للخريطة، سيطلب المتصفح تصريح الوصول للموقع
- اضغط "السماح" لتفعيل الخريطة المكانية

### الخصائص المتاحة:
✅ إنشاء منشور مع صورة وموقع GPS
✅ فتح الكاميرا مباشرة لالتقاط الصور
✅ البحث عن مستخدمين
✅ إضافة أصدقاء
✅ الدردشة الفورية
✅ عرض المنشورات على الخريطة التفاعلية

---

## 🔧 إذا واجهت مشاكل

### مشكلة: Backend لا يعمل
- تأكد من تشغيل PostgreSQL
- تأكد من صحة `DATABASE_URL` في ملف `.env`
- تأكد من تشغيل migration: `npm run migrate`

### مشكلة: Mapbox لا يظهر
- تحقق من `VITE_MAPBOX_TOKEN` في `.env.local`
- احصل على Token من: https://account.mapbox.com/access-tokens/
- Token الصحيح يبدأ بـ `pk.`

### مشكلة: لا يمكن إنشاء منشور
- تأكد من السماح بالوصول للموقع في المتصفح
- افتح Console في المتصفح (F12) وتحقق من الأخطاء

### مشكلة: الدردشة لا تعمل
- تأكد من تشغيل Backend
- تحقق من اتصال WebSocket في Console

---

## 📚 معلومات إضافية

### هيكل المشروع
```
APPAGQ/
├── backend/          # Node.js + Express + PostgreSQL
├── client/           # React + Mapbox + Vite
├── README.md
└── SETUP.md         # هذا الملف
```

### APIs المتاحة
- `/api/auth/*` - المصادقة
- `/api/posts/*` - المنشورات
- `/api/users/*` - المستخدمين
- `/api/friends/*` - الأصدقاء

### الوثائق
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/api/)
- [PostGIS](https://postgis.net/documentation/)
- [React](https://react.dev/)
- [Socket.IO](https://socket.io/docs/)

---

## 🤝 الدعم

إذا واجهت أي مشكلة، افتح issue في المشروع أو راجع الـ logs في:
- Backend: نافذة Terminal الخاصة بـ `backend`
- Frontend: Console في المتصفح (F12)

---

**مُطوّر بواسطة Antigravity AI** 🚀
