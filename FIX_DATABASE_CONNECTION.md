# ⚠️ تحديث مطلوب - معلومات PostgreSQL

حدثت مشكلة في الاتصال بقاعدة البيانات.

## 🔧 ما يجب فعله:

### تحديث ملف .env

افتح ملف **`backend\.env`** وعدّل السطر التالي:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/spatial_social_network
```

استبدل:
- **USERNAME** ← اسم مستخدم PostgreSQL (غالباً `postgres`)
- **PASSWORD** ← كلمة المرور التي وضعتها عند تثبيت PostgreSQL

## 🔍 كيف تجد كلمة المرور؟

### إذا أنشأت المستخدم postgres:
1. افتح pgAdmin أو psql
2. استخدم كلمة المرور التي وضعتها عند الإنشاء

### إذا نسيت كلمة المرور:
يمكنك إعادة تعيينها:

```bash
# افتح psql كـ Administrator
psql -U postgres

# غيّر كلمة المرور
ALTER USER postgres WITH PASSWORD 'new_password';
```

## 📝 أمثلة:

إذا كانت كلمة المرور `admin`:
```env
DATABASE_URL=postgresql://postgres:admin@localhost:5432/spatial_social_network
```

إذا كانت كلمة المرور `12345`:
```env
DATABASE_URL=postgresql://postgres:12345@localhost:5432/spatial_social_network
```

---

**بعد التعديل**: قم بتشغيل Migration مرة أخرى:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd backend
node migrations/init.js
```
