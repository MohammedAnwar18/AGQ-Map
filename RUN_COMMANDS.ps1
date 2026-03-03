# خطوة واحدة فقط لتشغيل المشروع!

# 🚨 قبل التشغيل: تحديث كلمة مرور PostgreSQL
# افتح ملف backend\.env وضع كلمة المرور الصحيحة

# بعد التحديث، شغّل الأوامر التالية:

# ========================================
# 1️⃣ تشغيل Backend (نافذة 1)
# ========================================

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\Moham\Desktop\APPAGQ\backend"
node migrations/init.js
npm run dev

# اترك هذه النافذة مفتوحة ✅
# يجب أن تشاهد: "🚀 Server running on port 5000"

# ========================================
# 2️⃣ تشغيل Frontend (نافذة 2 جديدة)
# ========================================

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\Moham\Desktop\APPAGQ\client"
npm run dev

# يجب أن تشاهد: "➜ Local: http://localhost:5173/"

# ========================================
# 3️⃣ افتح المتصفح
# ========================================

# اذهب إلى: http://localhost:5173

# 🎉 استمتع بالمشروع!
