# 🗺️ Spatial Social Network - دليل البدء السريع

## ✅ قبل البدء

تحتاج إلى:
1. **PostgreSQL** مع **PostGIS** مُثبّت ويعمل
2. **Mapbox Access Token** - احصل عليه من [mapbox.com](https://account.mapbox.com/access-tokens/)
3. **Node.js** v18+

---

## 🚀 خطوات التشغيل (5 دقائق)

### 1️⃣ إعداد قاعدة البيانات

افتح **PostgreSQL** واكتب:

```sql
CREATE DATABASE spatial_social_network;
\c spatial_social_network
CREATE EXTENSION postgis;
```

---

### 2️⃣ Backend Setup

```bash
cd backend

# تثبيت المكتبات
npm install

# إنشاء ملف .env ووضع البيانات التالية:
# PORT=5000
# DATABASE_URL=postgresql://postgres:password@localhost:5432/spatial_social_network
# JWT_SECRET=your_secret_key
# MAPBOX_TOKEN=your_mapbox_token
# CLIENT_URL=http://localhost:5173

# تشغيل Migration
npm run migrate

# تشغيل Backend
npm run dev
```

✅ **يجب أن يعمل على**: http://localhost:5000

---

### 3️⃣ Frontend Setup

افتح **نافذة Terminal جديدة**:

```bash
cd client

# تثبيت المكتبات
npm install

# تعديل ملف .env.local ووضع:
# VITE_MAPBOX_TOKEN=your_mapbox_token

# تشغيل Frontend
npm run dev
```

✅ **يجب أن يعمل على**: http://localhost:5173

---

## 🎉 هذا كل شيء!

افتح المتصفح واذهب إلى: **http://localhost:5173**

---

## 📖 مزيد من التفاصيل

- راجع `SETUP.md` للدليل الكامل المفصّل
- راجع `PROJECT_SUMMARY.md` لفهم بنية المشروع
- راجع `README.md` للمعلومات العامة

---

## ⚠️ ملاحظات مهمة

1. **Mapbox Token** إلزامي - بدونه الخريطة لن تعمل
2. **PostgreSQL** يجب أن يعمل على المنفذ الافتراضي 5432
3. **PostGIS Extension** إلزامي
4. **Backend** يجب أن يعمل قبل تشغيل Frontend

---

## 🆘 حل المشاكل السريع

### الخريطة لا تظهر؟
→ تحقق من `VITE_MAPBOX_TOKEN` في `client/.env.local`

### Backend لا يعمل؟
→ تحقق من `DATABASE_URL` في `backend/.env`
→ تأكد من تشغيل PostgreSQL

### Migration فشل؟
→ تأكد من تثبيت PostGIS:
```sql
CREATE EXTENSION postgis;
SELECT PostGIS_Version();
```

---

**جاهز! استمتع بالمشروع** 🎊
