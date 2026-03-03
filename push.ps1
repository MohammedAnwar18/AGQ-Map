param(
    [string]$message = "تحديث جديد للمشروع من localhost"
)

Write-Host "🔄 جاري تجهيز الملفات المعدلة..." -ForegroundColor Cyan
& "C:\Program Files\Git\bin\git.exe" add .

Write-Host "📝 جاري حفظ التعديلات باسم: $message" -ForegroundColor Yellow
& "C:\Program Files\Git\bin\git.exe" commit -m $message

Write-Host "🚀 جاري الرفع إلى GitHub..." -ForegroundColor Green
& "C:\Program Files\Git\bin\git.exe" push

Write-Host "✅ تم الرفع بنجاح!" -ForegroundColor Green
