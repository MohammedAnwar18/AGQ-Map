const fs = require('fs');

let content = fs.readFileSync('client/src/components/MedicalCenterProfileModal.jsx', 'utf8');

// Replace standard terms with medical terms
content = content.replace(/إضافة منتج أو خدمة/g, 'إضافة قسم أو عيادة');
content = content.replace(/تعديل المنتج/g, 'تعديل القسم / العيادة');
content = content.replace(/إضافة المنتج/g, 'إضافة القسم / العيادة');
content = content.replace(/حفظ المنتج/g, 'حفظ القسم / العيادة');
content = content.replace(/تعديل المنتج/g, 'تعديل القسم / العيادة');
content = content.replace(/حذف هذا المنتج/g, 'حذف هذا القسم / العيادة');
content = content.replace(/المنتج/g, 'القسم / العيادة');
content = content.replace(/منتج/g, 'قسم / عيادة');

// Shop equivalents
content = content.replace(/حذف المحل/g, 'حذف المركز');
content = content.replace(/حذف هذا المحل/g, 'حذف هذا المركز');
content = content.replace(/المحلات الموجودة داخل/g, 'العيادات / الأقسام داخل');
content = content.replace(/محل:/g, 'عيادة / قسم:');
content = content.replace(/إضافة محل داخلي/g, 'إضافة عيادة داخلية');
content = content.replace(/حول المحل/g, 'حول المركز');

// Styling colors (replace Orange with Medical Red)
content = content.replace(/#fbab15/g, '#ef4444');
content = content.replace(/rgba\(251,\s*171,\s*21,\s*0\.15\)/g, 'rgba(239, 68, 68, 0.15)');
content = content.replace(/rgba\(251,\s*171,\s*21,\s*0\.1\)/g, 'rgba(239, 68, 68, 0.1)');

fs.writeFileSync('client/src/components/MedicalCenterProfileModal.jsx', content, 'utf8');
console.log("Replacements complete.");
