/**
 * حفظ ملف على جهاز المستخدم — يعمل على كل المتصفحات.
 *
 * الترتيب المقصود: التنزيل المباشر أولاً دائماً، لأنه ما يتوقّعه المستخدم
 * (يهبط الملف في «التنزيلات»). ولا نلجأ لورقة المشاركة أو فتح تبويب
 * إلا حين لا يدعم المتصفح التنزيل أصلاً — كمتصفّحات التطبيقات المدمجة.
 */

// هل يدعم المتصفح سمة download على الروابط؟
// (سفاري iOS يدعمها منذ الإصدار ١٣، وكل المتصفحات الحديثة تدعمها)
const supportsAnchorDownload = () => {
    if (typeof document === 'undefined') return false;
    return 'download' in document.createElement('a');
};

const anchorDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    link.remove();

    // نمهل المتصفح ليبدأ التنزيل قبل تحرير الرابط
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/**
 * يحفظ ملفاً على الجهاز ويعيد الطريقة التي نجحت:
 *   'download' | 'share' | 'tab'
 */
export const saveFile = async (blob, filename, mime) => {
    const typed = blob.type ? blob : new Blob([blob], { type: mime });

    // ١) إيدج/إنترنت إكسبلورر القديمة
    if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) {
        navigator.msSaveOrOpenBlob(typed, filename);
        return 'download';
    }

    // ٢) الطريق الأساسي: تنزيل مباشر إلى الجهاز
    if (supportsAnchorDownload()) {
        anchorDownload(typed, filename);
        return 'download';
    }

    // ٣) متصفح لا يدعم التنزيل: نعرض ورقة المشاركة ليحفظ منها
    try {
        const file = new File([typed], filename, { type: typed.type || mime });
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            return 'share';
        }
    } catch (e) {
        if (e?.name === 'AbortError') return 'share';   // ألغى المستخدم
    }

    // ٤) الملاذ الأخير: نفتحه في تبويب ليحفظه يدوياً
    const url = URL.createObjectURL(typed);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return 'tab';
};
