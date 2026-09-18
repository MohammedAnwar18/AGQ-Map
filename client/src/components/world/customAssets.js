import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyToonMaterial } from './toon.js';

/* ============================================================
   المجسمات المستوردة من جهازك

   تُخزَّن في IndexedDB داخل المتصفّح، فتبقى بعد إغلاق الصفحة ولا
   تُرفع إلى أي خادم.

   ملف ‎.gltf‎ ليس مكتفياً بذاته: هو JSON يشير بالاسم إلى ملف هندسة
   ‎.bin‎ وإلى صور الخامات. لذلك نقرأ الـ JSON عند الاستيراد ونُقارن
   ما يطلبه بما اخترته، فنقول لك باسمه ما ينقص — بدل أن نُحمّل مجسماً
   ناقصاً ثم لا يظهر شيء ولا تعرف لماذا.
   ============================================================ */

const DB_NAME = 'palnovaa_world_models';
const STORE = 'models';
const DB_VERSION = 1;

let dbPromise = null;

const openDB = () => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return reject(new Error('المتصفّح لا يدعم التخزين المحلي للملفات'));

        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('تعذّر فتح مخزن المجسمات'));
    });

    return dbPromise;
};

const tx = async (mode, run) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let request;
        try { request = run(store); } catch (e) { return reject(e); }

        t.oncomplete = () => resolve(request?.result);
        t.onerror = () => reject(t.error || new Error('فشلت عملية التخزين'));
        t.onabort = () => reject(t.error || new Error('أُلغيت عملية التخزين — قد تكون مساحة المتصفّح ممتلئة'));
    });
};

export const listCustom = () => tx('readonly', s => s.getAll())
    .then(rows => (rows || []).map(({ key, name, entry, addedAt, size, stats }) =>
        ({ key, name, entry, addedAt, size, stats })));

export const getCustom = (key) => tx('readonly', s => s.get(key));
export const putCustom = (record) => tx('readwrite', s => s.put(record));

export const deleteCustom = (key) => {
    forgetCache(key);
    return tx('readwrite', s => s.delete(key));
};

// ── فحص ما يطلبه الملف ──────────────────────────────────────

const GEOMETRY_EXT = /\.(glb|gltf)$/i;

/** الاسم المجرّد من مساره ومن حالة أحرفه — ويندوز لا يُفرّق بينها */
export const plainName = (path) => decodeURIComponent(
    String(path).split(/[\\/]/).pop().split('?')[0].split('#')[0]
).toLowerCase();

/**
 * يقرأ الـ JSON ويُعيد أسماء كل ما يشير إليه من ملفات خارجية.
 * الروابط المضمّنة (data:) ليست ملفات فنتجاهلها.
 */
export const requiredFiles = (json) => {
    const wanted = new Set();

    const collect = (list) => {
        for (const item of list || []) {
            const uri = item?.uri;
            if (!uri || uri.startsWith('data:')) continue;
            wanted.add(plainName(uri));
        }
    };

    collect(json.buffers);
    collect(json.images);
    return [...wanted];
};

// ── الاستيراد ───────────────────────────────────────────────

/**
 * يبني سجلّاً من الملفات التي اختارها المستخدم، بعد التحقّق من
 * اكتمالها. يرمي خطأً مفصّلاً يذكر الملفات الناقصة بأسمائها.
 */
export const importFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) throw new Error('لم تُختَر ملفات');

    const entries = files.filter(f => GEOMETRY_EXT.test(f.name));

    if (!entries.length) {
        const kinds = [...new Set(files.map(f => (f.name.match(/\.[^.]+$/) || ['بلا امتداد'])[0]))];
        throw new Error(
            `لا ملف ‎.glb‎ أو ‎.gltf‎ بين ما اخترت (وجدتُ: ${kinds.slice(0, 5).join('، ')}). `
            + 'ملفات الصور و‎.bin‎ وحدها ليست مجسماً — اختر معها ملف المشهد نفسه.'
        );
    }

    // مجلّد كامل قد يحوي عدّة مشاهد: نأخذ الأكبر ونُخبر بما فعلنا
    entries.sort((a, b) => b.size - a.size);
    const entry = entries[0];
    const isGlb = /\.glb$/i.test(entry.name);

    const stored = {};
    let size = 0;
    for (const file of files) {
        stored[plainName(file.name)] = file;
        size += file.size;
    }

    let missing = [];

    if (!isGlb) {
        let json;
        try {
            json = JSON.parse(await entry.text());
        } catch {
            throw new Error(`تعذّر قراءة ${entry.name} — الملف ليس glTF صالحاً`);
        }

        missing = requiredFiles(json).filter(name => !stored[name]);

        if (missing.length) {
            const shown = missing.slice(0, 6).join('، ');
            throw new Error(
                `ينقص ${missing.length} ملف${missing.length > 1 ? 'اً' : ''} يطلبها ${entry.name}: ${shown}`
                + `${missing.length > 6 ? ' وغيرها' : ''}. `
                + 'الأسهل: اضغط «استورد مجلّداً» واختر المجلّد كلّه دفعة واحدة.'
            );
        }
    }

    const record = {
        key: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: entry.name.replace(GEOMETRY_EXT, ''),
        entry: plainName(entry.name),
        files: stored,
        size,
        addedAt: new Date().toISOString(),
        extras: entries.length - 1
    };

    await putCustom(record);

    // نُحمّله فوراً بدل انتظار أوّل وضع: إن كان معطوباً فليُعرَف الآن
    try {
        const { stats } = await loadCustom(record.key, 'toon');
        record.stats = stats;
        await putCustom(record);
    } catch (err) {
        await deleteCustom(record.key);
        throw new Error(`تعذّر تحميل ${entry.name}: ${err.message}`);
    }

    return record;
};

// ── التحميل ─────────────────────────────────────────────────

// نُحمّل الملف مرّة واحدة (raw) ونبني منه نسخة لكل نمط عرض (styled)،
// والمشهد يستنسخ من المُنمَّطة — فعشر نسخ لا تعني عشر عمليات تحميل
const rawCache = new Map();
const styledCache = new Map();

const forgetCache = (key) => {
    rawCache.delete(key);
    styledCache.delete(`${key}|toon`);
    styledCache.delete(`${key}|real`);
};

/** تغيير نمط العرض يُبطل النسخ المُنمَّطة وحدها، لا الملفات المحمَّلة */
export const forgetStyled = () => styledCache.clear();

const MAX_SPAN = 120;   // متر — أكبر من هذا يُرجَّح أنه بالسنتيمترات
const MIN_SPAN = 0.15;

const normalize = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return { scale: 1, dims: [0, 0, 0], empty: true };

    let size = box.getSize(new THREE.Vector3());
    let span = Math.max(size.x, size.y, size.z);
    let scale = 1;

    if (span > MAX_SPAN || (span > 0 && span < MIN_SPAN)) {
        scale = 8 / span;
        object.scale.multiplyScalar(scale);
        box.setFromObject(object);
        size = box.getSize(new THREE.Vector3());
        span = Math.max(size.x, size.y, size.z);
    }

    const center = box.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;

    return {
        scale,
        dims: [+size.x.toFixed(1), +size.y.toFixed(1), +size.z.toFixed(1)],
        empty: span === 0
    };
};

const countMeshes = (root) => {
    let meshes = 0;
    let triangles = 0;
    root.traverse((child) => {
        if (!child.isMesh) return;
        meshes++;
        const index = child.geometry?.index;
        const pos = child.geometry?.attributes?.position;
        triangles += Math.round(((index?.count ?? pos?.count) || 0) / 3);
    });
    return { meshes, triangles };
};

const loadRaw = async (record) => {
    const urls = new Map();
    const revoke = [];

    for (const [name, blob] of Object.entries(record.files || {})) {
        const url = URL.createObjectURL(blob);
        urls.set(name, url);
        revoke.push(url);
    }

    const manager = new THREE.LoadingManager();

    // glTF يشير إلى ملفاته بمسارات نسبية؛ نردّ كل اسم إلى رابط blob
    // الخاص به، بلا حساسية لحالة الأحرف ولا للمجلّدات التي سبقته.
    manager.setURLModifier((url) => urls.get(plainName(url)) || url);

    const entryUrl = urls.get(record.entry);
    if (!entryUrl) throw new Error('ملف المشهد مفقود من السجلّ');

    try {
        const loader = new GLTFLoader(manager);
        const gltf = await loader.loadAsync(entryUrl);

        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) throw new Error('الملف لا يحتوي مشهداً');

        const counts = countMeshes(root);
        if (!counts.meshes) throw new Error('الملف لا يحتوي أي شبكة قابلة للرسم');

        return { root, counts };
    } finally {
        // لا نُحرّر فوراً: فكّ ضغط بعض الصور يتأخّر عن وعد التحميل،
        // والتحرير المبكّر يُنتج مجسماً بلا خامات بلا رسالة خطأ
        setTimeout(() => revoke.forEach(url => URL.revokeObjectURL(url)), 30000);
    }
};

/**
 * يُعيد نسخة أصلاً جاهزة بالنمط المطلوب، مع إحصاءاته.
 * النمط «الواقعي» يُبقي خامات glTF كما صُدِّرت — الخرائط المعدنية
 * والخشونة والانحناء — والنمط الكرتوني يستبدلها بتظليل مسطّح.
 */
export const loadCustom = (key, style = 'toon') => {
    const cacheKey = `${key}|${style}`;
    if (styledCache.has(cacheKey)) return styledCache.get(cacheKey);

    if (!rawCache.has(key)) {
        rawCache.set(
            key,
            getCustom(key)
                .then(record => {
                    if (!record) throw new Error('المجسم غير موجود في هذا المتصفّح');
                    return loadRaw(record);
                })
                .catch(err => { rawCache.delete(key); throw err; })
        );
    }

    const promise = rawCache.get(key).then(({ root, counts }) => {
        const styled = root.clone(true);
        if (style === 'toon') applyToonMaterial(styled);
        else prepareRealistic(styled);

        const info = normalize(styled);
        return {
            root: styled,
            stats: { ...counts, dims: info.dims, rescaled: info.scale !== 1 }
        };
    }).catch(err => { styledCache.delete(cacheKey); throw err; });

    styledCache.set(cacheKey, promise);
    return promise;
};

/** النمط الواقعي: نُبقي الخامة الأصلية ونُفعّل الظلال فقط */
const prepareRealistic = (root) => {
    root.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;

        const list = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of list) {
            if (!material) continue;
            // انعكاس البيئة يجعل المعدن معدناً؛ بدونه يبدو طلاءً باهتاً
            if ('envMapIntensity' in material) material.envMapIntensity = 1;
        }
    });
    return root;
};

/** تحميل ملف ‎.glb‎ من مسار عادي — يخدم الأصول المسجّلة في ASSETS */
export const loadUrl = (url, style = 'toon') => {
    const cacheKey = `${url}|${style}`;
    if (styledCache.has(cacheKey)) return styledCache.get(cacheKey);

    const promise = new GLTFLoader().loadAsync(url).then(gltf => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) throw new Error('الملف لا يحتوي مشهداً');

        if (style === 'toon') applyToonMaterial(root);
        else prepareRealistic(root);

        const info = normalize(root);
        return { root, stats: { ...countMeshes(root), dims: info.dims } };
    }).catch(err => { styledCache.delete(cacheKey); throw err; });

    styledCache.set(cacheKey, promise);
    return promise;
};

export const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كب`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} مب`;
};

export const describeStats = (stats) => {
    if (!stats) return '';
    const [x, y, z] = stats.dims || [];
    const size = x ? ` · ${x}×${y}×${z} م` : '';
    return `${stats.meshes} شبكة${size}`;
};
