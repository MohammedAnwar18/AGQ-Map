# 🔍 تشخيص مشكلة الخريطة

## الخطوات:

### 1️⃣ افتح Console في المتصفح
- اضغط **F12**
- اختر تبويب **Console**

### 2️⃣ ابحث عن الرسائل التالية:

✅ **إذا ظهرت هذه الرسائل (كل شيء يعمل):**
```
🗺️ Mapbox Token: موجود ✅
🚀 بدء تهيئة الخريطة...
📍 إنشاء خريطة Mapbox...
✅ الخريطة تم تحميلها بنجاح!
```

❌ **إذا ظهرت رسائل خطأ حمراء:**
- انسخها وأرسلها لي

### 3️⃣ افحص Elements
- في Developer Tools، اختر تبويب **Elements**
- ابحث عن `<div class="map-container">`
- تأكد من وجود `<canvas>` بداخله

### 4️⃣ جرب هذه الحلول:

#### الحل 1: امسح Cache
```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

#### الحل 2: تحقق من Token
- افتح ملف `client\.env.local`
- تأكد من وجود:
```
VITE_MAPBOX_TOKEN=pk.YOUR_MAPBOX_TOKEN_HERE
```

#### الحل 3: أعد تشغيل Frontend
```powershell
# أوقف Frontend (Ctrl+C)
# ثم شغله مرة أخرى
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd client
npm run dev
```

### 5️⃣ افتح في وضع Incognito
- افتح المتصفح في وضع التصفح الخاص
- اذهب إلى `http://localhost:5173`

---

## 📸 أرسل لي:
1. **لقطة شاشة** من Console
2. **الرسائل** التي تظهر (إن وجدت)
3. **هل ترى canvas** في Elements؟
