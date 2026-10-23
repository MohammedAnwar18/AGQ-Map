import { affineFromWorldFile, affineFromGdal } from './rasterGeo.js';

/* ============================================================
   راستر — الإحداثيات من الملفّات المجاورة

   كثير من ملفّات التيف لا تحمل إحداثياتها في داخلها. وبرامج ‎Arc‎
   و‎QGIS‎ تفتحها في موضعها الصحيح لأنّها تقرأ ما بجانبها:

     ‎name.tfw‎          ستّة أرقام: المقياس والدوران والأصل
     ‎name.tif.aux.xml‎  ملفّ ‎GDAL‎ المساعد، فيه ‎GeoTransform‎ والمرجع
     ‎name.prj‎          المرجع وحده بصيغة ‎WKT‎

   فكان رفضُنا للملفّ خطأً في التغطية لا عطباً في ملفّ المستخدم:
   الإحداثيات موجودة، لكنّها في ملفّ لم نطلبه.
   ============================================================ */

/** اسم الملفّ بلا امتداده — ‎a.tif‎ و‎a.tfw‎ يُقترنان به */
export const stemOf = (filename) => String(filename || '')
    .toLowerCase()
    /* ‎ortho.tif.aux.xml‎ امتدادان لا واحد: تُقشَّر ‎aux.xml‎ أوّلاً
       فيبقى ‎ortho.tif‎، ثمّ يُقشَّر الامتداد فيبقى الجذر */
    .replace(/\.aux\.xml$/, '')
    .replace(/\.(tif|tiff|tfw|twf|wld|prj|ovr)$/, '');

export const sidecarKind = (filename) => {
    const name = String(filename || '').toLowerCase();

    if (/\.aux\.xml$/.test(name)) return 'aux';
    if (/\.(tfw|twf|wld)$/.test(name)) return 'world';
    if (/\.prj$/.test(name)) return 'prj';
    return null;
};

/**
 * ملفّ العالم: ستّة أرقام، سطراً سطراً.
 *
 * ونقبل الفواصل والمسافات معاً: ملفّات مُصدَّرة من ويندوز بإعدادات
 * عربية تكتب الفاصلة العشرية فاصلةً، فيصير السطر «0,5» لا «0.5».
 * ورفضُها لذلك قسوةٌ بلا سبب.
 */
export const parseWorldFile = (text) => {
    const numbers = String(text || '')
        .split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            // فاصلة عشرية أوروبية: فاصلة واحدة بلا نقطة في السطر
            const fixed = (!line.includes('.') && (line.match(/,/g) || []).length === 1)
                ? line.replace(',', '.')
                : line;
            return parseFloat(fixed);
        });

    if (numbers.length < 6 || !numbers.slice(0, 6).every(Number.isFinite)) {
        return { error: 'ملفّ ‎.tfw‎ يجب أن يحتوي ستّة أرقام' };
    }

    const transform = affineFromWorldFile(numbers.slice(0, 6));
    if (!transform) return { error: 'أرقام ‎.tfw‎ لا تُنتج تحويلاً صالحاً' };

    return { transform };
};

/* رقم ‎EPSG‎ من نصّ ‎WKT‎ — آخر ‎AUTHORITY‎ فيه هو مرجع المسقط نفسه */
const epsgFromWkt = (wkt) => {
    const text = String(wkt || '');

    const all = [...text.matchAll(/AUTHORITY\s*\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]/gi)];
    if (all.length) return `EPSG:${all[all.length - 1][1]}`;

    // ‎WKT2‎ يكتبها ‎ID["EPSG",32636]‎
    const id = [...text.matchAll(/ID\s*\[\s*"EPSG"\s*,\s*(\d+)\s*\]/gi)];
    if (id.length) return `EPSG:${id[id.length - 1][1]}`;

    return null;
};

export const parsePrj = (text) => {
    const crs = epsgFromWkt(text);
    return crs ? { crs } : { error: 'لم نجد رقم EPSG في ملفّ ‎.prj‎' };
};

/**
 * ملفّ ‎GDAL‎ المساعد.
 *
 * ‎<GeoTransform>‎ ستّة أرقام بفواصل، و‎<SRS>‎ نصّ ‎WKT‎. ونقرؤه
 * بتعبير نمطيّ لا بمُحلّل ‎XML‎: المطلوب عنصران معروفان، وبناء شجرة
 * ‎DOM‎ لملفّ قد يكون ضخماً (فيه مدرّجات وإحصاءات) ثمنٌ بلا مقابل.
 */
export const parseAuxXml = (text) => {
    const raw = String(text || '');

    const gtMatch = /<GeoTransform>([^<]+)<\/GeoTransform>/i.exec(raw);
    const srsMatch = /<SRS[^>]*>([\s\S]*?)<\/SRS>/i.exec(raw);

    const out = {};

    if (gtMatch) {
        const numbers = gtMatch[1].split(',').map(v => parseFloat(v.trim()));
        if (numbers.length >= 6 && numbers.every(Number.isFinite)) {
            const transform = affineFromGdal(numbers.slice(0, 6));
            if (transform) out.transform = transform;
        }
    }

    if (srsMatch) {
        const crs = epsgFromWkt(srsMatch[1]);
        if (crs) out.crs = crs;
    }

    if (!out.transform && !out.crs) return { error: 'لا GeoTransform ولا SRS في ملفّ ‎aux.xml‎' };
    return out;
};

/**
 * يقرأ ما وُجد بجانب التيف ويجمعه.
 *
 * ‎aux.xml‎ يسبق ‎.tfw‎ عند التعارض: هو ملفّ ‎GDAL‎ نفسه وزاويّ أصلاً،
 * فلا يحمل غموض نصف البكسل الذي يحمله ملفّ العالم. والمرجع من
 * ‎.prj‎ يُقبل حتى لو جاء التحويل من غيره.
 */
export const readSidecars = async (files) => {
    const found = { transform: null, crs: null, from: [], problems: [] };

    const byKind = { aux: null, world: null, prj: null };

    for (const file of files || []) {
        const kind = sidecarKind(file.name);
        if (kind && !byKind[kind]) byKind[kind] = file;
    }

    const readText = async (file) => {
        try {
            return await file.text();
        } catch {
            found.problems.push(`تعذّرت قراءة ${file.name}`);
            return null;
        }
    };

    if (byKind.aux) {
        const text = await readText(byKind.aux);
        const parsed = text === null ? null : parseAuxXml(text);

        if (parsed?.error) found.problems.push(`${byKind.aux.name}: ${parsed.error}`);
        if (parsed?.transform) { found.transform = parsed.transform; found.from.push('aux.xml'); }
        if (parsed?.crs) { found.crs = parsed.crs; found.from.push('SRS في aux.xml'); }
    }

    if (!found.transform && byKind.world) {
        const text = await readText(byKind.world);
        const parsed = text === null ? null : parseWorldFile(text);

        if (parsed?.error) found.problems.push(`${byKind.world.name}: ${parsed.error}`);
        if (parsed?.transform) { found.transform = parsed.transform; found.from.push(byKind.world.name); }
    }

    if (!found.crs && byKind.prj) {
        const text = await readText(byKind.prj);
        const parsed = text === null ? null : parsePrj(text);

        if (parsed?.error) found.problems.push(`${byKind.prj.name}: ${parsed.error}`);
        if (parsed?.crs) { found.crs = parsed.crs; found.from.push(byKind.prj.name); }
    }

    return found;
};
