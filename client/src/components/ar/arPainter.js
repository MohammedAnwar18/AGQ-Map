import {
    worldToScreen, toPixels, distance2D, bearingTo, angleDelta,
    projectOnPath, readableDistance
} from './indoorGeo';

/* ============================================================
   رسّام الواقع المعزّز

   كل ما هنا يرسم على لوحة ثنائية الأبعاد فوق صورة الكاميرا، لكن
   ما يُرسم محسوب في ثلاثة أبعاد: كل نقطة من المسار تُسقَط على
   الصورة بنفس هندسة العدسة، فتبدو ملتصقة بالبلاط لا مطبوعة على
   الزجاج.

   واللوحة الثنائية لا WebGL عمداً: ما نرسمه خطوط وسهام ولافتات،
   وهي أرخص هنا — ولا تُضيف حزمة ثلاثية الأبعاد فوق تيّار الكاميرا
   على هاتف متوسّط.
   ============================================================ */

export const PALETTE = {
    route: '#38BDF8',
    routeGlow: 'rgba(56, 189, 248, .35)',
    chevron: '#22D3EE',
    target: '#FBAB15',
    node: '#4ADE80',
    junction: '#94A3B8',
    draw: '#F472B6',
    shadow: 'rgba(3, 8, 18, .55)'
};

/** يرسم نصّاً عربياً في كبسولة — أوضح ما يكون فوق صورة متغيّرة */
export const drawPill = (ctx, x, y, text, {
    tone = PALETTE.route,
    fill = 'rgba(6, 12, 24, .82)',
    size = 13,
    weight = 700,
    padding = 9
} = {}) => {
    ctx.save();
    ctx.font = `${weight} ${size}px "IBM Plex Sans Arabic", "Tajawal", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const width = ctx.measureText(text).width + padding * 2;
    const height = size + padding;
    const radius = height / 2;

    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, radius);

    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = tone;
    ctx.stroke();

    ctx.fillStyle = '#F1F5F9';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();

    return { width, height };
};

/**
 * يُسقط خطّاً من نقاط الأرض إلى نقاط الشاشة.
 *
 * ما خلف الكاميرا يُقطع لا يُطوى: نقطة خلفك تُسقَط رياضياً إلى
 * موضع أمامك — وهو ما يجعل المسار ينقلب على نفسه إن لم تُستبعد.
 * فنقطعه إلى قطع متّصلة، كل قطعة أمام الكاميرا كلّها.
 */
export const projectPolyline = (points, view) => {
    const { pose, origin, eye, fov, aspect, width, height } = view;
    const runs = [];
    let current = [];

    for (const p of points) {
        const screen = worldToScreen({ x: p.x, y: 0, z: p.z }, pose, origin, eye, fov, aspect);

        if (!screen) {
            if (current.length > 1) runs.push(current);
            current = [];
            continue;
        }

        const px = toPixels(screen, width, height);
        current.push({ ...px, depth: screen.depth, world: p });
    }

    if (current.length > 1) runs.push(current);
    return runs;
};

/**
 * شريط المسار على الأرض.
 *
 * عرضه يتناقص مع البعد كما يتناقص أي شيء حقيقي — وهذه وحدها هي ما
 * تُقنع العين أنه مفروش على الأرض لا مرسوم على الزجاج. ونرسمه
 * توهّجاً عريضاً ثم خطّاً حادّاً فوقه، فيُقرأ فوق أرضية فاتحة
 * وداكنة معاً.
 */
export const drawRoute = (ctx, points, view, { tone = PALETTE.route, glow = PALETTE.routeGlow } = {}) => {
    const runs = projectPolyline(points, view);

    for (const run of runs) {
        // التوهّج: عرض واحد للقطعة كلّها، أرخص من عرض لكل مقطع
        ctx.save();
        ctx.strokeStyle = glow;
        ctx.lineWidth = 26;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        run.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        ctx.restore();

        // القلب: عرض يتناقص مع العمق، مقطعاً مقطعاً
        for (let i = 1; i < run.length; i++) {
            const a = run[i - 1];
            const b = run[i];
            const depth = (a.depth + b.depth) / 2;

            ctx.save();
            ctx.strokeStyle = tone;
            ctx.lineWidth = Math.max(2, Math.min(15, 34 / Math.max(1, depth)));
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
        }
    }

    return runs;
};

/**
 * سهام تزحف على المسار.
 *
 * موزّعة بالمتر لا بالبكسل: سهم كل مترين على الأرض يعني تباعداً
 * صحيحاً في المنظور — تتقارب مع البعد كما يتقارب خطّ السكّة.
 * وتزحف مع الزمن، فيُقرأ الاتجاه بلا قراءة نصّ.
 */
export const drawChevrons = (ctx, points, view, { spacing = 1.6, phase = 0, tone = PALETTE.chevron } = {}) => {
    if (points.length < 2) return;

    const { pose, origin, eye, fov, aspect, width, height } = view;

    // مسافات تراكمية على الأرض
    let travelled = 0;
    let next = spacing * (((phase % 1) + 1) % 1);

    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const segment = distance2D(a, b);
        if (segment < 1e-4) continue;

        const heading = bearingTo(a, b);

        while (next <= travelled + segment) {
            const t = (next - travelled) / segment;
            const on = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };

            drawChevron(ctx, on, heading, { pose, origin, eye, fov, aspect, width, height }, tone);
            next += spacing;
        }

        travelled += segment;
    }
};

/**
 * سهم واحد يطفو فوق الأرض.
 *
 * ثلاث نقاط على مستوى مرفوع قليلاً عن الأرض ثم تُسقط كلّها — فيميل
 * مع الأرضية في المنظور بدل أن يبقى مثلّثاً مسطّحاً على الزجاج.
 *
 * ويُرسم ثلاث طبقات: هالة عريضة تحته تفصله عن أي أرضية مهما كان
 * لونها، ثم جسمه، ثم حرف فاتح على حافّته. هذا وحده هو الفرق بين
 * سهم يُرى في ممرّ مضيء وسهم يضيع فيه.
 */
const drawChevron = (ctx, at, heading, view, tone, scale = 1) => {
    const { pose, origin, eye, fov, aspect, width, height } = view;

    const rad = (heading * Math.PI) / 180;
    const fx = Math.sin(rad);
    const fz = Math.cos(rad);
    const rx = Math.cos(rad);
    const rz = -Math.sin(rad);

    // رأس سهم مجوّف: خمس نقاط لا ثلاث — الشكل الذي تقرأه العين
    // اتّجاهاً فوراً، وهو شكل سهام الملاحة في كل مكان
    const L = 0.62 * scale;     // نصف الطول
    const W = 0.52 * scale;     // نصف العرض
    const N = 0.26 * scale;     // عمق التجويف الخلفي
    const Y = 0.06;             // ارتفاعه عن الأرض — يمنع تزاحم العمق

    const ground = [
        [L, 0],
        [-N, W],
        [-N * 0.35, 0],
        [-N, -W]
    ].map(([f, r]) => ({
        x: at.x + fx * f + rx * r,
        y: Y,
        z: at.z + fz * f + rz * r
    }));

    const pts = ground.map(p => worldToScreen(p, pose, origin, eye, fov, aspect));
    if (pts.some(p => !p)) return;

    const px = pts.map(p => toPixels(p, width, height));
    const depth = pts[0].depth;

    // يخفت مع البعد، لكن لا يختفي: سهم على بُعد عشرين متراً هو ما
    // يقول إلى أين يمضي الممرّ بعد الباب
    const alpha = Math.max(0.35, Math.min(1, 16 / Math.max(1, depth)));

    ctx.save();
    ctx.globalAlpha = alpha;

    const path = () => {
        ctx.beginPath();
        ctx.moveTo(px[0].x, px[0].y);
        for (let i = 1; i < px.length; i++) ctx.lineTo(px[i].x, px[i].y);
        ctx.closePath();
    };

    // هالة
    ctx.shadowColor = tone;
    ctx.shadowBlur = Math.max(6, 40 / Math.max(1, depth));
    ctx.fillStyle = tone;
    path();
    ctx.fill();

    // جسم صلب فوق الهالة
    ctx.shadowBlur = 0;
    path();
    ctx.fill();

    // حرف فاتح
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = 'rgba(236, 254, 255, .9)';
    ctx.lineWidth = Math.max(1, Math.min(3, 8 / Math.max(1, depth)));
    ctx.lineJoin = 'round';
    path();
    ctx.stroke();

    ctx.restore();
};

/**
 * علامة مكان: عمود من الأرض تعلوه لافتة باسمه.
 *
 * العمود ضروري: لافتة تطفو بلا ساق تبدو ملصقة على الشاشة، والعمود
 * النازل إلى نقطة على الأرض يقول «هنا بالضبط».
 */
export const drawMarker = (ctx, node, view, {
    tone = PALETTE.node,
    label = true,
    poleHeight = 1.35,
    highlight = false
} = {}) => {
    const { pose, origin, eye, fov, aspect, width, height } = view;

    // ما حُدّد على رفّ أو جدار له ارتفاعه: عموده يصعد من الأرض
    // إليه لا إلى ارتفاع ثابت — وإلا طفت اللافتة في غير مكانها
    const top = Math.max(poleHeight, (node.y || 0) + 0.25);

    const foot = worldToScreen({ x: node.x, y: 0, z: node.z }, pose, origin, eye, fov, aspect);
    const head = worldToScreen({ x: node.x, y: top, z: node.z }, pose, origin, eye, fov, aspect);
    if (!foot || !head) return null;

    const a = toPixels(foot, width, height);
    const b = toPixels(head, width, height);
    const metres = distance2D(origin, node);

    ctx.save();

    // قاعدة بيضوية على الأرض: الدائرة المسقطة بيضوي، ورسمها دائرةً
    // يكسر الإيهام فوراً
    const radius = Math.max(4, Math.min(34, 26 / Math.max(1, foot.depth)));
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, radius, radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.shadow;
    ctx.fill();
    ctx.strokeStyle = tone;
    ctx.lineWidth = highlight ? 3 : 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = tone;
    ctx.lineWidth = highlight ? 3.4 : 2.2;
    ctx.stroke();

    ctx.restore();

    if (label) {
        drawPill(ctx, b.x, b.y - 14, `${node.name} · ${readableDistance(metres)}`, {
            tone,
            size: highlight ? 14 : 12.5,
            weight: highlight ? 800 : 700
        });
    }

    return { foot: a, head: b, distance: metres, depth: foot.depth };
};

/**
 * سهم الحافّة: يظهر حين تكون الوجهة خارج الشاشة.
 *
 * بدونه يدور المستخدم في مكانه يبحث عن المسار. والسهم على حافّة
 * الشاشة في اتجاهها يُنهي البحث في لحظة.
 */
export const drawOffscreenArrow = (ctx, target, view, tone = PALETTE.target) => {
    const { pose, origin, width, height } = view;

    const bearing = bearingTo(origin, target);
    const delta = angleDelta(pose.heading, bearing);

    // داخل نصف المجال تقريباً؟ إذاً هي على الشاشة ولا حاجة للسهم
    if (Math.abs(delta) < 28) return false;

    const margin = 46;
    const cx = width / 2;
    const cy = height * 0.62;
    const side = delta > 0 ? 1 : -1;

    const x = side > 0 ? width - margin : margin;
    const y = cy;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side > 0 ? 0 : Math.PI);

    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -15);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 15);
    ctx.closePath();

    ctx.fillStyle = tone;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.restore();

    drawPill(ctx, cx, cy + 44, `استدر ${side > 0 ? 'يميناً' : 'يساراً'} ${Math.round(Math.abs(delta))}°`, { tone });
    return true;
};

/** الخطّ الذي يرسمه الإصبع الآن — قبل أن يُثبَّت */
export const drawDraft = (ctx, points, view) => {
    if (points.length < 2) return;

    const runs = projectPolyline(points, view);

    ctx.save();
    ctx.strokeStyle = PALETTE.draw;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([12, 8]);

    for (const run of runs) {
        ctx.beginPath();
        run.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
    }

    ctx.restore();
};

/**
 * شبكة الأرض تحت القدمين.
 *
 * مرجع بصري يقول إن الحساب يعرف أين الأرض: مربّعات بمتر واحد حول
 * الواقف. بدونها يضع الأدمن نقطة ولا يدري إن كانت على بُعد متر أو
 * عشرة — ومعها يقرأ المسافة من عدد المربّعات.
 */
export const drawFloorGrid = (ctx, view, { extent = 6, step = 1 } = {}) => {
    const { pose, origin, eye, fov, aspect, width, height } = view;

    // نلتقط الشبكة على أعداد صحيحة في إطار العالم، فتبدو ثابتة على
    // الأرض حين تمشي بدل أن تزحف معك
    const baseX = Math.round(origin.x / step) * step;
    const baseZ = Math.round(origin.z / step) * step;

    ctx.save();
    ctx.lineWidth = 1;

    const line = (a, b) => {
        const pa = worldToScreen({ x: a.x, y: 0, z: a.z }, pose, origin, eye, fov, aspect);
        const pb = worldToScreen({ x: b.x, y: 0, z: b.z }, pose, origin, eye, fov, aspect);
        if (!pa || !pb) return;

        const A = toPixels(pa, width, height);
        const B = toPixels(pb, width, height);

        ctx.globalAlpha = Math.max(0.04, 0.3 - Math.min(pa.depth, pb.depth) * 0.03);
        ctx.strokeStyle = '#BAE6FD';
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
    };

    for (let i = -extent; i <= extent; i += step) {
        line({ x: baseX + i, z: baseZ - extent }, { x: baseX + i, z: baseZ + extent });
        line({ x: baseX - extent, z: baseZ + i }, { x: baseX + extent, z: baseZ + i });
    }

    ctx.restore();
};

/**
 * حالة التوجيه: أين أنت من المسار وما التعليمة.
 *
 * محسوبة هنا لا في الرسم: الواجهة تعرضها نصّاً والرسّام يعرضها
 * سهاماً، وحسابها مرّتين يعني اختلافهما يوماً ما.
 */
export const guidanceState = (polyline, position, pose, { offTrack = 6 } = {}) => {
    if (!polyline || polyline.length < 2) return null;

    const on = projectOnPath(polyline, position);
    if (!on) return null;

    const target = polyline[polyline.length - 1];
    const arrived = on.remaining < 2.2 && on.offset < 4;

    // إلى أين ننظر الآن مقارنةً بالمسار: النقطة التي أمامنا بثلاثة
    // أمتار على الخطّ لا النقطة التي نقف عليها — وإلا دار السهم في
    // مكانه كلّما تذبذبت البوصلة
    const ahead = pointAt(polyline, Math.min(on.total, on.along + 3));
    const bearing = ahead ? bearingTo(position, ahead) : bearingTo(position, target);

    return {
        along: on.along,
        total: on.total,
        remaining: on.remaining,
        offset: on.offset,
        offTrack: on.offset > offTrack,
        bearing,
        turn: angleDelta(pose.heading, bearing),
        arrived,
        target
    };
};

/** النقطة على الخطّ بعد مسافة معيّنة من بدايته */
export const pointAt = (points, along) => {
    if (!points.length) return null;
    if (along <= 0) return points[0];

    let travelled = 0;
    for (let i = 1; i < points.length; i++) {
        const segment = distance2D(points[i - 1], points[i]);
        if (travelled + segment >= along) {
            const t = segment > 0 ? (along - travelled) / segment : 0;
            return {
                x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
                z: points[i - 1].z + (points[i].z - points[i - 1].z) * t
            };
        }
        travelled += segment;
    }

    return points[points.length - 1];
};


/**
 * شاخص التصويب.
 *
 * حلقة في منتصف الشاشة على النقطة التي تُشير إليها الكاميرا، ومعها
 * مسافتها وارتفاعها. هو ما يجعل التحديد دقيقاً: تُوجّه الهاتف
 * فترى بالضبط أين ستقع النقطة قبل أن تضعها — بدل أن تلمس الشاشة
 * بإبهامك وتتمنّى.
 *
 * وهي حلقة بيضوية على الأرض ودائرة في الهواء: المسقط يقول أيّهما.
 */
export const drawReticle = (ctx, aim, view, { tone, label = true } = {}) => {
    const { pose, origin, eye, fov, aspect, width, height } = view;

    // المصدر يُلوّن الحلقة: ما قيس ذهبيّ، وما خُمّن باهت. فيُرى
    // الفرق قبل الضغط لا بعد أن تُحفظ النقطة في غير موضعها
    const source = aim.source || (aim.onFloor ? 'floor' : 'guess');
    const onFloor = source === 'floor';
    const shade = tone || (source === 'guess' ? 'rgba(148, 163, 184, .85)' : PALETTE.target);

    const at = worldToScreen({ x: aim.x, y: aim.y || 0, z: aim.z }, pose, origin, eye, fov, aspect);
    if (!at) return null;

    const p = toPixels(at, width, height);
    const radius = Math.max(9, Math.min(42, 44 / Math.max(1, at.depth)));

    ctx.save();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 2.4;
    if (source === 'guess') ctx.setLineDash([6, 5]);

    ctx.beginPath();
    if (onFloor) ctx.ellipse(p.x, p.y, radius, radius * 0.4, 0, 0, Math.PI * 2);
    else ctx.arc(p.x, p.y, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // صليب صغير في المركز: الحلقة وحدها تُخفي مركزها
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y);
    ctx.lineTo(p.x + 7, p.y);
    ctx.moveTo(p.x, p.y - 7);
    ctx.lineTo(p.x, p.y + 7);
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    // عمود إلى الأرض حين تكون النقطة معلّقة، فتُقرأ مسافتها
    if (!onFloor && aim.y > 0.3) {
        const foot = worldToScreen({ x: aim.x, y: 0, z: aim.z }, pose, origin, eye, fov, aspect);
        if (foot) {
            const f = toPixels(foot, width, height);
            ctx.globalAlpha = 0.45;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(f.x, f.y);
            ctx.stroke();
        }
    }

    ctx.restore();

    if (label) {
        const where = aim.y > 0.3 ? `ارتفاع ${aim.y.toFixed(1)} م` : 'على الأرض';
        const how = source === 'motion' ? ' · بالحركة' : source === 'guess' ? ' · تقديري' : '';
        drawPill(ctx, p.x, p.y + radius + 20,
            `${readableDistance(aim.distance)} · ${where}${how}`,
            { tone: shade, size: 12 });
    }

    return p;
};

/**
 * ما حولك الآن — شريط اتّجاهات على حافّة الشاشة.
 *
 * ليس كل ما وضعتَه أمامك: بعضه خلفك وبعضه عن يمينك. هذا الشريط
 * يقول أين هي بلا أن تدور تبحث، وهو ما يُحوّل الكاميرا من «نافذة
 * على ما أمامي» إلى «إحساس بما حولي».
 */
export const drawNearby = (ctx, nodes, view, { max = 5, range = 30, tone = '#94A3B8' } = {}) => {
    const { pose, origin, width } = view;

    const around = nodes
        .filter(n => n.kind !== 'junction')
        .map(n => ({ node: n, distance: distance2D(origin, n), turn: angleDelta(pose.heading, bearingTo(origin, n)) }))
        .filter(n => n.distance <= range)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, max);

    if (!around.length) return [];

    ctx.save();
    around.forEach((item, i) => {
        // الموضع الأفقي يتبع الاتّجاه: ما هو أمامك في الوسط، وما عن
        // يمينك إلى اليمين — شريط يُقرأ كبوصلة لا كقائمة
        const t = Math.max(-1, Math.min(1, item.turn / 90));
        const x = width / 2 + t * (width / 2 - 62);
        const y = 118 + i * 30;

        ctx.globalAlpha = Math.abs(item.turn) > 90 ? 0.45 : 0.95;
        drawPill(ctx, x, y, `${item.node.name} · ${readableDistance(item.distance)}`, {
            tone, size: 11.5, weight: 700, padding: 8
        });
    });
    ctx.restore();

    return around;
};
