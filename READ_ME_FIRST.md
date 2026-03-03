# 🚨 خطوة واحدة فقط مطلوبة منك!

## المشكلة:
لا أستطيع الاتصال بـ PostgreSQL لأن كلمة المرور غير معروفة.

## ✅ الحل (خطوة واحدة بسيطة):

### الطريقة 1️⃣: تحديث كلمة المرور في ملف .env

1. **افتح ملف**: `APPAGQ\backend\.env`
2. **ابحث عن السطر**:
   ```
   DATABASE_URL=postgresql://postgres:root@localhost:5432/spatial_social_network
   ```
3. **غيّر `root`** إلى كلمة مرور PostgreSQL الصحيحة
4. **احفظ الملف**

**الكلمات الشائعة**: `postgres`, `admin`, `password`, `12345`, `root`

---

### الطريقة 2️⃣: إعادة تعيين كلمة المرور

افتح **Command Prompt كـ Administrator**:

```bash
# شغّل psql
psql -U postgres

# غيّر كلمة المرور إلى "admin"
ALTER USER postgres WITH PASSWORD 'admin';

# اخرج
\q
```

ثم في ملف `.env` ضع:
```
DATABASE_URL=postgresql://postgres:admin@localhost:5432/spatial_social_network
```

---

## 🚀 بعد التحديث:

**فقط أخبرني** وسأكمل كل شيء تلقائياً!

أو شغّل:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd backend
node migrations/init.js
npm run dev
```

ثم في نافذة جديدة:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd client
npm install
npm run dev
```

افتح: **http://localhost:5173**

---

**ملاحظة**: هذه الخطوة ضرورية مرة واحدة فقط! بعدها كل شيء سيعمل تلقائياً 🎉
