/* ============================================================
   نانوتراك — ما يبقى بعد إغلاق الصفحة

   المسارات تُحفظ في المتصفّح نفسه لا على الخادم، وهذا مقصود:

     · تعمل بلا حساب وبلا إنترنت — وأكثر ما يُرسم داخل مبنى يُرسم
       حيث لا تصل الشبكة أصلاً
     · لا تُرفع خريطة بيتك إلى أي مكان
     · تُفتح فوراً، فلا انتظار قبل أن ترى مسارك

   والثمن صريح: المسار يعيش في هذا المتصفّح على هذا الهاتف. مسح
   بيانات الموقع يمسحه، ولا ينتقل إلى هاتف آخر. لذلك في الواجهة
   تصدير ونسخ — حتّى لا يضيع ما تعبتَ فيه بلا إنذار.
   ============================================================ */

const KEY = 'palnovaa.nanotrack.v1';

/*
 * كل قراءة وكتابة داخل ‎try‎.
 *
 * التخزين يرمي في التصفّح الخاص، وحين تُمنع بيانات الموقع، وحين
 * تمتلئ الحصّة. وميزة تتعطّل أهون من صفحة تنهار.
 */
const readAll = () => {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(t => t && t.id && Array.isArray(t.points)) : [];
    } catch {
        return [];
    }
};

const writeAll = (tracks) => {
    try {
        localStorage.setItem(KEY, JSON.stringify(tracks));
        return { ok: true };
    } catch (error) {
        // الحصّة امتلأت غالباً — والمستخدم يستحقّ أن يعرف قبل أن
        // يمشي المسار كلّه ثم يكتشف أنه لم يُحفظ
        return { ok: false, why: error?.name === 'QuotaExceededError'
            ? 'ذاكرة المتصفّح امتلأت — احذف مساراً قديماً'
            : 'تعذّر الحفظ في هذا المتصفّح' };
    }
};

let counter = 0;
const newId = () => `nt${Date.now().toString(36)}${(++counter).toString(36)}`;

/** الأحدث أوّلاً — آخر ما رسمتَه هو أوّل ما تبحث عنه */
export const listTracks = () => readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

export const getTrack = (id) => readAll().find(t => t.id === id) || null;

/**
 * يحفظ مساراً جديداً أو يستبدل واحداً موجوداً.
 *
 * ‎base‎ هو طول القاعدة بين الشريطين يوم الإنشاء، ولا يُلمس بعدها:
 * هو المسطرة التي تُقاس بها كل جلسة لاحقة.
 */
export const saveTrack = ({ id, name, points, base, height, note }) => {
    const tracks = readAll();
    const now = Date.now();
    const at = tracks.findIndex(t => t.id === id);

    const clean = (points || []).map(p => ({
        x: +Number(p.x).toFixed(3),
        z: +Number(p.z).toFixed(3),
        ...(p.label ? { label: String(p.label).slice(0, 60) } : {})
    })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.z));

    const track = {
        v: 1,
        id: id || newId(),
        name: String(name || 'مسار').slice(0, 60),
        note: note ? String(note).slice(0, 200) : null,
        base: +Number(base).toFixed(3),
        height: height || 1.7,
        points: clean,
        createdAt: at >= 0 ? tracks[at].createdAt : now,
        updatedAt: now
    };

    if (at >= 0) tracks[at] = track;
    else tracks.push(track);

    const written = writeAll(tracks);
    return written.ok ? { ok: true, track } : written;
};

export const deleteTrack = (id) => {
    const left = readAll().filter(t => t.id !== id);
    return writeAll(left);
};

/** نسخة نصّية يمكن إرسالها لنفسك — الاحتياط ضدّ متصفّح يُمسح */
export const exportTrack = (track) => JSON.stringify({
    nanotrack: 1,
    name: track.name,
    base: track.base,
    height: track.height,
    points: track.points
}, null, 1);

/** وقراءتها على هاتف آخر */
export const importTrack = (text) => {
    try {
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.points) || !(data.base > 0)) {
            return { ok: false, why: 'النصّ ليس مساراً من نانوتراك' };
        }
        return saveTrack({
            name: data.name || 'مسار مستورَد',
            points: data.points,
            base: data.base,
            height: data.height
        });
    } catch {
        return { ok: false, why: 'النصّ غير مقروء' };
    }
};
