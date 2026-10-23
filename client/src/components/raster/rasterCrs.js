import proj4 from 'proj4';

export { KNOWN_CRS } from './rasterCrsList';

/* ============================================================
   راستر — مراجع الإحداثيات

   الـ‎GeoTIFF‎ يحمل رقم مرجعه في وسوم ‎GeoKey‎. وقراءته منها أصدق من
   تخمينه من حجم الأرقام: ‎700000‎ شرقاً تصلح لعشر مناطق ‎UTM‎، والتخمين
   يضع الصورة في بلد مجاور ثم لا يعرف أحدٌ لماذا.

   ومع ذلك يبقى التخمين موجوداً: ملفّات كثيرة تُصدَّر بلا ‎GeoKey‎
   صالح. حينها نخمّن ونقول صريحاً إنّنا خمّنّا وأيّ مرجع افترضنا،
   فيصحّحه من يعرف.
   ============================================================ */

/*
 * المراجع المستعملة هنا.
 *
 * ‎UTM 36N‎ هو الأشيع لفلسطين، و‎2039‎ شبكة إسرائيل الحديثة، و‎28191‎
 * شبكة فلسطين القديمة التي تُصدَّر بها الخرائط التاريخية.
 */
const DEFS = {
    'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs',
    'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
    'EPSG:2039': '+proj=tmerc +lat_0=31.734393611111 +lon_0=35.204516944444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,55,52,0,0,0,0 +units=m +no_defs',
    'EPSG:28191': '+proj=cass +lat_0=31.734097222222 +lon_0=35.212056111111 +x_0=170251.555 +y_0=126867.909 +a=6378300.789 +b=6356566.435 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs',
    'EPSG:28192': '+proj=tmerc +lat_0=31.734097222222 +lon_0=35.212056111111 +k=1 +x_0=170251.555 +y_0=1126867.909 +a=6378300.789 +b=6356566.435 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs',
    'EPSG:28193': '+proj=cass +lat_0=31.734097222222 +lon_0=35.212056111111 +x_0=170251.555 +y_0=1126867.909 +a=6378300.789 +b=6356566.435 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs'
};

/** مناطق ‎UTM‎ الشمالية تُبنى بالقاعدة لا واحدةً واحدة */
for (let zone = 1; zone <= 60; zone++) {
    DEFS[`EPSG:${32600 + zone}`] = `+proj=utm +zone=${zone} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
    DEFS[`EPSG:${32700 + zone}`] = `+proj=utm +zone=${zone} +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
}

for (const [code, def] of Object.entries(DEFS)) {
    if (!proj4.defs(code)) proj4.defs(code, def);
}


export const isSupported = (code) => Boolean(code && proj4.defs(code));

/**
 * رقم المرجع من وسوم الملفّ.
 *
 * ‎ProjectedCSTypeGeoKey‎ للمساقط و‎GeographicTypeGeoKey‎ للدرجات.
 * و‎32767‎ تعني «معرَّف داخل الملفّ» — أي مسقط مخصّص لا نعرفه،
 * فنعدّه مجهولاً بصراحة.
 */
export const crsFromGeoKeys = (geoKeys) => {
    if (!geoKeys) return null;

    const projected = geoKeys.ProjectedCSTypeGeoKey;
    if (projected && projected !== 32767) {
        const code = `EPSG:${projected}`;
        return isSupported(code) ? code : { unsupported: code };
    }

    const geographic = geoKeys.GeographicTypeGeoKey;
    if (geographic && geographic !== 32767) {
        // ‎4326‎ وما يكافئها: كلّها درجات، والفرق بينها دون متر
        if (geographic === 4326 || geographic === 4322 || geographic === 4019) return 'EPSG:4326';
        const code = `EPSG:${geographic}`;
        return isSupported(code) ? code : { unsupported: code };
    }

    return null;
};

/**
 * تخمين المرجع من حجم الإحداثيات — آخر ملاذ.
 *
 * الأرقام الصغيرة درجات. والكبيرة أمتار، وتمييزها يعتمد على مدى
 * الشرق والشمال: شبكة فلسطين شمالها مئة ألف أو مليون ومئة ألف،
 * و‎ITM‎ شمالها ستّمئة ألف، و‎UTM 36N‎ شمالها ثلاثة ملايين ونصف.
 */
export const guessCrs = (x, y) => {
    const ax = Math.abs(x);
    const ay = Math.abs(y);

    if (ax <= 180 && ay <= 90) return 'EPSG:4326';

    // شبكة فلسطين: شرق ١٠٠–٣٠٠ ألف
    if (ax > 100000 && ax < 300000) {
        if (ay > 1000000 && ay < 1300000) return 'EPSG:28192';
        if (ay > 50000 && ay < 350000) return 'EPSG:28191';
        if (ay > 350000 && ay < 900000) return 'EPSG:2039';
    }

    // ‎UTM‎: شرق ١٦٠–٨٤٠ ألف وشمال بالملايين
    if (ax > 160000 && ax < 840000 && ay > 1000000 && ay < 9400000) return 'EPSG:32636';

    // ماسنريتور: أرقام بالملايين في المحورين
    if (ax > 1000000) return 'EPSG:3857';

    return 'EPSG:32636';
};

/** محوّل من مرجع المصدر إلى الدرجات، وعكسه */
export const transformer = (fromCode) => {
    if (fromCode === 'EPSG:4326') {
        return {
            toLonLat: (x, y) => [x, y],
            fromLonLat: (lon, lat) => [lon, lat]
        };
    }

    const forward = proj4(fromCode, 'EPSG:4326');
    const backward = proj4('EPSG:4326', fromCode);

    return {
        toLonLat: (x, y) => forward.forward([x, y]),
        fromLonLat: (lon, lat) => backward.forward([lon, lat])
    };
};
