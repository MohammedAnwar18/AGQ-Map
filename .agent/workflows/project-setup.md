---
description: دليل إعداد وتشغيل المشروع
---

# 🚀 دليل إعداد مشروع الشبكة الاجتماعية المكانية

## المتطلبات الأساسية
- Node.js (v18 أو أحدث)
- PostgreSQL (v14 أو أحدث) مع PostGIS
- npm أو yarn

## خطوات الإعداد

### 1. إعداد قاعدة البيانات
```sql
-- إنشاء قاعدة البيانات
CREATE DATABASE spatial_social_network;

-- الاتصال بقاعدة البيانات
\c spatial_social_network

-- تفعيل PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

### 2. إعداد Backend
// turbo-all
```bash
cd backend
npm install
```

### 3. إعداد ملف البيئة
إنشاء ملف `.env` في مجلد `backend`:
```
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/spatial_social_network
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
MAPBOX_TOKEN=your_mapbox_access_token
```

### 4. تشغيل Migrations
// turbo
```bash
cd backend
npm run migrate
```

### 5. تشغيل Backend Server
// turbo
```bash
cd backend
npm run dev
```

### 6. إعداد Frontend
// turbo
```bash
cd client
npm install
```

### 7. تشغيل Frontend
// turbo
```bash
cd client
npm run dev
```

## الوصول للتطبيق
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- WebSocket: ws://localhost:5000

## المميزات المتوفرة
✅ تسجيل الدخول والتسجيل
✅ الخريطة التفاعلية
✅ إنشاء منشورات مع الموقع
✅ البحث عن المستخدمين
✅ نظام الأصدقاء (إرسال/قبول/رفض الطلبات)
✅ الدردشة الفورية
✅ التقاط الصور من الكاميرا
✅ تحديد الموقع تلقائياً
