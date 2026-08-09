# 🚀 Admin Dashboard - Quick Start Guide

## خطوات سريعة للبدء

### 1️⃣ تشغيل الـ Migration
```bash
cd backend
node migrations/add_admin_role.js
```

### 2️⃣ إنشاء حساب أدمن

#### الطريقة الأولى: باستخدام Script (الأسهل) ⭐
```bash
cd backend
node scripts/make-admin.js YOUR_USERNAME
```

مثال:
```bash
node scripts/make-admin.js mohammad
```

#### الطريقة الثانية: من قاعدة البيانات مباشرة
```sql
UPDATE users SET role = 'admin' WHERE username = 'YOUR_USERNAME';
```

أو باستخدام ID:
```sql
UPDATE users SET role = 'admin' WHERE id = 1;
```

### 3️⃣ تسجيل الدخول
1. افتح المتصفح: `http://localhost:5173/login`
2. سجل دخول بحساب الأدمن
3. اذهب إلى: `http://localhost:5173/admin`

---

## ✅ التحقق من نجاح العملية

بعد تسجيل الدخول، يجب أن ترى:
- ✅ Dashboard Overview مع الإحصائيات
- ✅ Sidebar مع الأقسام (Overview, Users, Posts, Map)
- ✅ إمكانية إدارة المستخدمين والمنشورات

---

## 🔧 استكشاف الأخطاء

### المشكلة: "Access Denied: Admin privileges required"
**الحل**: تأكد من أن المستخدم لديه `role = 'admin'` في قاعدة البيانات

```sql
SELECT id, username, role FROM users WHERE username = 'YOUR_USERNAME';
```

### المشكلة: الصفحة تعيد التوجيه إلى /map
**الحل**: نفس الحل أعلاه - تحقق من الـ role

### المشكلة: لا تظهر البيانات في Dashboard
**الحل**: تأكد من:
1. السيرفر يعمل: `http://localhost:5000`
2. قاعدة البيانات متصلة
3. هناك بيانات في الجداول

---

## 📋 الوظائف المتاحة

### Overview
- عرض الإحصائيات الشاملة
- عدد المستخدمين والمنشورات
- النشاط اليومي

### Users Management
- **البحث**: ابحث عن أي مستخدم
- **View**: عرض تفاصيل المستخدم
- **Suspend**: إيقاف الحساب مؤقتاً
- **Activate**: تفعيل الحساب الموقوف
- **Delete**: حذف المستخدم نهائياً

### Posts Management
- عرض جميع المنشورات
- حذف أي منشور
- رؤية تفاصيل كل منشور

---

## 🎯 نصائح مهمة

1. **لا تحذف حسابك**: الأدمن لا يستطيع حذف نفسه (محمي)
2. **النسخ الاحتياطي**: احتفظ بنسخة من قاعدة البيانات قبل الحذف
3. **التأكيد**: جميع عمليات الحذف تطلب تأكيد
4. **الأمان**: لا تشارك بيانات دخول الأدمن

---

## 🔐 الأمان

- ✅ جميع الـ routes محمية
- ✅ التحقق من الـ JWT Token
- ✅ التحقق من الـ role
- ✅ منع الوصول غير المصرح
- ✅ حماية من حذف الأدمن لنفسه

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. تحقق من console السيرفر
2. تحقق من console المتصفح
3. راجع ملف `ADMIN_DASHBOARD.md` للتفاصيل الكاملة

---

**🎉 الآن أنت جاهز لإدارة PalNova!**
