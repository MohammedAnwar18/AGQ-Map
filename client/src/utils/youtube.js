/**
 * أدوات روابط يوتيوب — تُستخدم في لوحة الإدارة وفي غلاف صفحة المحل.
 * تدعم الصيغ الشائعة: watch?v= و youtu.be و /embed/ و /shorts/ و /live/.
 */

export const parseYouTubeId = (input) => {
    const url = String(input || '').trim();
    if (!url) return null;

    // معرّف مباشر (١١ محرفاً)
    if (/^[\w-]{11}$/.test(url)) return url;

    const patterns = [
        /[?&]v=([\w-]{11})/,
        /youtu\.be\/([\w-]{11})/,
        /\/embed\/([\w-]{11})/,
        /\/shorts\/([\w-]{11})/,
        /\/live\/([\w-]{11})/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

/**
 * معاملات مشغّل بلا أي واجهة ليوتيوب: بلا أزرار ولا شعار ولا مقترحات،
 * يعمل صامتاً ويعيد نفسه ليصلح كغلاف متحرك.
 */
export const youtubeCoverVars = (videoId) => ({
    autoplay: 1,
    mute: 1,
    loop: 1,
    playlist: videoId,      // مطلوب حتى يعمل التكرار لفيديو واحد
    controls: 0,
    modestbranding: 1,
    rel: 0,
    iv_load_policy: 3,      // إخفاء التعليقات التوضيحية
    disablekb: 1,
    fs: 0,
    playsinline: 1,
    cc_load_policy: 0
});

export const youtubeThumb = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

export const youtubeThumbHd = (videoId) => `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

/**
 * يحمّل واجهة IFrame Player مرة واحدة فقط لكل صفحة.
 * نحتاجها لنعرف متى يعمل الفيديو فعلاً، فنُظهره حينها فقط
 * ونُخفيه في أي لحظة قد يرسم فيها يوتيوب زر التشغيل أو شاشة النهاية.
 */
let apiPromise = null;

export const loadYouTubeApi = () => {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve(window.YT);
        };

        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => {
            apiPromise = null;
            reject(new Error('تعذّر تحميل مشغّل يوتيوب'));
        };
        document.head.appendChild(script);
    });

    return apiPromise;
};
