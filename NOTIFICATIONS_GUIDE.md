# نظام الإشعارات - دليل التشغيل

## ✅ ما تم إنجازه

تم إنشاء نظام إشعارات متكامل يعرض:
- 🔔 طلبات الصداقة الجديدة
- ✅ قبول طلبات الصداقة
- 📸 المنشورات الجديدة (جاهز للتفعيل)
- 💬 التعليقات (جاهز للتفعيل)

## 📋 خطوات التشغيل

### 1. إنشاء جدول الإشعارات في قاعدة البيانات

قم بتشغيل الأمر التالي في PostgreSQL:

```sql
-- افتح psql أو pgAdmin وشغل هذا الكود:

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
```

**أو** استخدم الملف الجاهز:
```bash
# في PowerShell أو CMD
psql -U postgres -d spatial_social_network -f backend/migrations/create_notifications.sql
```

### 2. التأكد من تشغيل السيرفر

السيرفر يعمل بالفعل على المنفذ 5000 ✅

### 3. التأكد من تشغيل العميل

العميل يعمل على المنفذ 5174 ✅
افتح المتصفح على: http://localhost:5174

## 🎯 كيفية الاستخدام

### عرض الإشعارات:
1. انظر إلى الشريط العلوي في الخريطة
2. ستجد أيقونة الجرس 🔔
3. إذا كان هناك إشعارات غير مقروءة، ستظهر نقطة حمراء مع العدد
4. اضغط على الأيقونة لفتح قائمة الإشعارات

### اختبار النظام:
1. سجل دخول بحسابين مختلفين (في متصفحين أو نوافذ تصفح خفي)
2. من الحساب الأول، أرسل طلب صداقة للحساب الثاني
3. في الحساب الثاني، ستظهر نقطة حمراء على أيقونة الإشعارات
4. اضغط على الأيقونة لرؤية الإشعار
5. اضغط على الإشعار لتحديده كمقروء

## 📊 أنواع الإشعارات المدعومة

| النوع | الأيقونة | الوصف |
|------|---------|-------|
| `friend_request` | 👥 | طلب صداقة جديد |
| `friend_accepted` | ✅ | تم قبول طلب الصداقة |
| `new_post` | 📸 | منشور جديد من صديق |
| `post_comment` | 💬 | تعليق على منشورك |

## 🔧 استكشاف الأخطاء

### إذا لم تظهر الإشعارات:
1. تأكد من إنشاء جدول `notifications` في قاعدة البيانات
2. افتح Console في المتصفح (F12) وتحقق من الأخطاء
3. تأكد من أن السيرفر يعمل بدون أخطاء
4. تحديث الصفحة (F5)

### إذا كان العداد لا يتحدث:
- النظام يحدث العداد تلقائياً كل 30 ثانية
- يمكنك تحديث الصفحة للحصول على آخر التحديثات فوراً

## 📁 الملفات المضافة

### Frontend:
- `client/src/components/NotificationsModal.jsx` - مكون الإشعارات
- `client/src/components/NotificationsModal.css` - تصميم الإشعارات

### Backend:
- `backend/controllers/notificationController.js` - منطق الإشعارات
- `backend/routes/notifications.js` - مسارات API
- `backend/migrations/create_notifications.sql` - إنشاء الجدول

### تحديثات:
- `backend/server.js` - إضافة route الإشعارات
- `backend/controllers/friendController.js` - إرسال إشعارات عند طلبات الصداقة
- `client/src/pages/Map.jsx` - إضافة أيقونة وعداد الإشعارات

## 🎨 المميزات

✅ عداد الإشعارات غير المقروءة (نقطة حمراء)
✅ تحديث تلقائي كل 30 ثانية
✅ تمييز الإشعارات المقروءة/غير المقروءة
✅ عرض الوقت النسبي (منذ 5 دقائق، منذ ساعة...)
✅ تصميم احترافي مع animations
✅ تحديد الإشعار كمقروء عند الضغط عليه

## 🚀 التطوير المستقبلي

يمكن إضافة إشعارات للأحداث التالية:
- 📸 منشور جديد من صديق
- 💬 تعليق جديد على منشورك
- ❤️ إعجاب بمنشورك
- 📍 صديق قريب منك على الخريطة
