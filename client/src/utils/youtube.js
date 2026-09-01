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
 * رابط تشغيل بلا أي واجهة ليوتيوب: بلا أزرار ولا شعار ولا مقترحات،
 * يعمل صامتاً ويعيد نفسه ليصلح كغلاف متحرك.
 */
export const youtubeCoverSrc = (videoId) => {
    const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        loop: '1',
        playlist: videoId,      // مطلوب حتى يعمل التكرار لفيديو واحد
        controls: '0',
        modestbranding: '1',
        showinfo: '0',
        rel: '0',
        iv_load_policy: '3',    // إخفاء التعليقات التوضيحية
        disablekb: '1',
        fs: '0',
        playsinline: '1',
        cc_load_policy: '0',
        vq: 'hd1080'            // تلميح للجودة العالية
    });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

export const youtubeThumb = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
