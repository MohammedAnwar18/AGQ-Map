import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyToonMaterial } from './toon';

/* ============================================================
   المجسمات المستوردة من جهازك

   تُخزَّن في IndexedDB داخل المتصفّح، فتبقى بعد إغلاق الصفحة ولا
   تُرفع إلى أي خادم. العالم المحفوظ يشير إليها بمفتاحها، فإن فُتح
   على جهاز آخر ظهرت كصندوق بديل بدل أن ينكسر المشهد.

   صيغتان:
   • ‎.glb‎  — ملف واحد مكتفٍ بذاته، وهو الأسهل والأوصى به.
   • ‎.gltf‎ — يشير إلى ‎.bin‎ وصور خارجية، فنطلب اختيارها معه ونحلّ
     مساراتها النسبية إلى روابط blob عبر مُعدّل الروابط في المدير.
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
        let result;
        try { result = run(store); } catch (e) { return reject(e); }

        t.oncomplete = () => resolve(result?.result !== undefined ? result.result : result);
        t.onerror = () => reject(t.error);
    });
};

export const listCustom = () => tx('readonly', s => s.getAll())
    .then(rows => (rows || []).map(({ key, name, entry, addedAt, size }) => ({ key, name, entry, addedAt, size })));

export const getCustom = (key) => tx('readonly', s => s.get(key));
export const deleteCustom = (key) => { cache.delete(key); return tx('readwrite', s => s.delete(key)); };
export const putCustom = (record) => tx('readwrite', s => s.put(record));

// ── الاستيراد ───────────────────────────────────────────────

const GEOMETRY_EXT = /\.(glb|gltf)$/i;

/**
 * يبني سجلّاً من الملفات التي اختارها المستخدم.
 * يقبل ‎.glb‎ وحده، أو ‎.gltf‎ ومعه ‎.bin‎ وصوره.
 */
export const importFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) throw new Error('لم تُختَر ملفات');

    const entries = files.filter(f => GEOMETRY_EXT.test(f.name));
    if (!entries.length) throw new Error('اختر ملف ‎.glb‎ أو ‎.gltf‎ — ومعه ملفاته إن كان gltf');
    if (entries.length > 1) throw new Error(`اخترت ${entries.length} مجسمات دفعةً واحدة — استورد واحداً في كل مرّة`);

    const entry = entries[0];
    const isGlb = /\.glb$/i.test(entry.name);

    // ‎.gltf‎ بلا ملفاته يُحمَّل ناقصاً بلا هندسة ولا خامات
    if (!isGlb && !files.some(f => /\.bin$/i.test(f.name))) {
        throw new Error('ملف gltf يحتاج ملف ‎.bin‎ وصوره — اخترها كلّها معاً');
    }

    const stored = {};
    let size = 0;
    for (const file of files) {
        // نُسقط المسار ونُبقي الاسم: مُعدّل الروابط يبحث بالاسم وحده
        stored[file.name] = file;
        size += file.size;
    }

    const record = {
        key: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: entry.name.replace(GEOMETRY_EXT, ''),
        entry: entry.name,
        files: stored,
        size,
        addedAt: new Date().toISOString()
    };

    await putCustom(record);
    return record;
};

// ── التحميل ─────────────────────────────────────────────────

// نُحمّل الملف مرّة واحدة ونستنسخه لكل نسخة في المشهد
const cache = new Map();

const MAX_SPAN = 60;   // متر — أكبر من هذا يُرجَّح أنه بالسنتيمترات
const MIN_SPAN = 0.2;

/**
 * يُوسّط المجسم على محوريه الأفقيين، ويُنزله ليقف على الأرض،
 * ويُعيده إلى مقياس معقول إن كان مصدَّراً بوحدة أخرى.
 */
const normalize = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.y, size.z);

        let scale = 1;
        if (span > MAX_SPAN || (span > 0 && span < MIN_SPAN)) {
            scale = 8 / span;
            object.scale.multiplyScalar(scale);
            box.setFromObject(object);
        }

        const center = box.getCenter(new THREE.Vector3());
        object.position.x -= center.x;
        object.position.z -= center.z;
        object.position.y -= box.min.y;

        return { scale, span };
    }
    return { scale: 1, span: 0 };
};

const loadFromRecord = async (record) => {
    const urls = new Map();
    const revoke = [];

    for (const [name, blob] of Object.entries(record.files || {})) {
        const url = URL.createObjectURL(blob);
        urls.set(name, url);
        revoke.push(url);
    }

    const manager = new THREE.LoadingManager();

    // glTF يشير إلى ملفاته بمسارات نسبية؛ نردّ كل اسم إلى رابط blob
    // الخاص به. رابط الملف الرئيسي نفسه لا يُطابق شيئاً فيمرّ كما هو.
    manager.setURLModifier((url) => {
        const base = decodeURIComponent(String(url).split(/[\\/]/).pop().split('?')[0]);
        return urls.get(base) || url;
    });

    try {
        const loader = new GLTFLoader(manager);
        const gltf = await loader.loadAsync(urls.get(record.entry));

        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) throw new Error('الملف لا يحتوي مشهداً');

        applyToonMaterial(root);
        const info = normalize(root);

        return { root, info };
    } finally {
        // الهندسة والصور صارت في الذاكرة، فلا حاجة للروابط بعدها
        revoke.forEach(url => URL.revokeObjectURL(url));
    }
};

/** يُرجع وعداً بالمجسم — مُخزَّن، فالنسخة العاشرة لا تُعيد التحميل */
export const loadCustom = (key) => {
    if (cache.has(key)) return cache.get(key);

    const promise = getCustom(key)
        .then(record => {
            if (!record) throw new Error('المجسم غير موجود في هذا المتصفّح');
            return loadFromRecord(record);
        })
        .catch(err => {
            cache.delete(key);   // نسمح بإعادة المحاولة
            throw err;
        });

    cache.set(key, promise);
    return promise;
};

/** تحميل ملف ‎.glb‎ من مسار عادي — يخدم الأصول المسجّلة في ASSETS */
export const loadUrl = (url) => {
    if (cache.has(url)) return cache.get(url);

    const promise = new GLTFLoader().loadAsync(url).then(gltf => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) throw new Error('الملف لا يحتوي مشهداً');
        applyToonMaterial(root);
        return { root, info: normalize(root) };
    }).catch(err => {
        cache.delete(url);
        throw err;
    });

    cache.set(url, promise);
    return promise;
};

export const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كب`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} مب`;
};
