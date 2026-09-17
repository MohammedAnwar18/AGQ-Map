const pool = require('../config/database');
const {
    probeArea, reverseName, polygonAreaKm2, centroid, CATEGORY_LABELS,
    nearestStreet, searchPlaces, bufferLine
} = require('../utils/osm');
const { STANCES } = require('./hellyController');

/**
 * الطبقة المكانية في HellyAgents.
 *
 * شقّان: قراءة ما في المنطقة المرسومة من OpenStreetMap، وحساب احتمالية
 * الترجيح من حالة المحاكاة نفسها.
 *
 * الاحتمالية هنا محسوبة لا مُولّدة: النموذج اللغوي لا يقترب منها البتّة.
 * كل نقطة مئوية مردودة إلى معادلة صريحة يُرجعها الحقل breakdown، فيرى
 * المستخدم لماذا أُعطيت هذه النسبة وعلى أي أساس بالضبط.
 */

// أقصى مساحة نقبل فحصها — أكبر من ذلك يُثقل خوادم Overpass العامّة
const MAX_AREA_KM2 = 40;

// وزن كل موقف على محور [-1, +1]
const STANCE_VALUE = {
    'مؤيّد بشدّة': 1,
    'مؤيّد': 0.5,
    'محايد': 0,
    'معارض': -0.5,
    'معارض بشدّة': -1
};

const isAdmin = (req) => req.user?.role === 'admin';

const requireAdmin = (req, res) => {
    if (isAdmin(req)) return true;
    res.status(403).json({ error: 'هذه الميزة للأدمن العام فقط' });
    return false;
};

const sanitizeRing = (input) => {
    if (!Array.isArray(input) || input.length < 3) return null;

    const ring = [];
    for (const point of input) {
        const lon = Number(Array.isArray(point) ? point[0] : point?.lon ?? point?.lng);
        const lat = Number(Array.isArray(point) ? point[1] : point?.lat);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
        ring.push([lon, lat]);
    }

    const [f] = ring;
    const l = ring[ring.length - 1];
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push([f[0], f[1]]);

    return ring.length > 200 ? null : ring;
};

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// ── فحص المنطقة المرسومة ─────────────────────────────────────
const probeSpatial = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const ring = sanitizeRing(req.body.ring ?? req.body.area);
        if (!ring) return res.status(400).json({ error: 'الشكل المرسوم غير صالح — ارسم مضلّعاً مغلقاً' });

        const areaKm2 = polygonAreaKm2(ring);
        if (areaKm2 > MAX_AREA_KM2) {
            return res.status(400).json({
                error: `المنطقة واسعة جداً (${round1(areaKm2)} كم²). الحدّ ${MAX_AREA_KM2} كم² — ارسم نطاقاً أضيق.`
            });
        }

        const context = await probeArea(ring);
        const placeName = await reverseName(context.centroid);

        res.json({ context, place_name: placeName, ring });
    } catch (e) {
        console.error('OSM probe error:', e);
        res.status(502).json({ error: e.message || 'تعذّر قراءة بيانات OpenStreetMap' });
    }
};

// ── التقاط شارع بالنقر عليه ──────────────────────────────────
const captureStreet = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const lat = Number(req.body.lat);
        const lon = Number(req.body.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ error: 'إحداثيات غير صالحة' });
        }

        // عرض الشريط حول محور الشارع — من ١٠ إلى ١٢٠ متراً
        const width = clamp(Number(req.body.width) || 35, 10, 120);

        const street = await nearestStreet({ lat, lon });
        if (!street) return res.status(404).json({ error: 'لا شارع مسمّى قرب هذه النقطة — جرّب النقر أقرب إلى محور الشارع' });

        const ring = bufferLine(street.coords, width);
        if (!ring) return res.status(422).json({ error: 'تعذّر بناء نطاق حول هذا الشارع' });

        res.json({
            ring,
            street: { name: street.name, kind: street.kind, distance_m: street.distance_m },
            area_km2: round1(polygonAreaKm2(ring) * 100) / 100
        });
    } catch (e) {
        console.error('Street capture error:', e);
        res.status(502).json({ error: e.message || 'تعذّر التقاط الشارع' });
    }
};

// ── بحث بالاسم ───────────────────────────────────────────────
const searchPlace = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const q = String(req.query.q || '').trim().slice(0, 160);
        if (q.length < 2) return res.json({ results: [] });

        res.json({ results: await searchPlaces(q) });
    } catch (e) {
        console.error('Place search error:', e);
        res.json({ results: [] });
    }
};

// ── أدوات القياس ─────────────────────────────────────────────

/** متوسّط المواقف مرجّحاً بالنفوذ — يقع في [-1, +1] */
const supportIndex = (rows, stanceOf = (r) => r.stance) => {
    let weighted = 0;
    let weight = 0;

    for (const row of rows) {
        const value = STANCE_VALUE[stanceOf(row)];
        if (value === undefined) continue;
        const w = Math.max(1, Number(row.influence) || 5);
        weighted += w * value;
        weight += w;
    }
    return weight ? weighted / weight : 0;
};

const distribution = (rows, stanceOf = (r) => r.stance) => {
    const counts = {};
    STANCES.forEach(s => { counts[s] = 0; });
    rows.forEach(r => { counts[stanceOf(r)] = (counts[stanceOf(r)] || 0) + 1; });
    return counts;
};

const haversineM = (a, b) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * يُعيد بناء موقف كل وكيل عند نهاية كل جولة، انطلاقاً من موقفه المبدئي
 * وتطبيق ما سجّلته الأحداث بالترتيب. هكذا نرسم خطّ الرأي عبر الزمن
 * من وقائع محفوظة لا من تقدير.
 */
const buildTrend = (agents, events, totalRounds) => {
    const current = new Map(agents.map(a => [a.id, a.initial_stance]));
    const byRound = new Map();

    for (const event of events) {
        if (!event.agent_id || !event.stance_after) continue;
        if (!byRound.has(event.round)) byRound.set(event.round, []);
        byRound.get(event.round).push(event);
    }

    const trend = [{
        round: 0,
        support: round1(supportIndex(agents, a => a.initial_stance) * 100),
        moved: 0,
        ...distribution(agents, a => a.initial_stance)
    }];

    for (let r = 1; r <= totalRounds; r++) {
        const moves = byRound.get(r) || [];
        let moved = 0;

        for (const move of moves) {
            if (current.get(move.agent_id) !== move.stance_after) moved++;
            current.set(move.agent_id, move.stance_after);
        }

        const snapshot = agents.map(a => ({ influence: a.influence, stance: current.get(a.id) }));
        trend.push({
            round: r,
            support: round1(supportIndex(snapshot) * 100),
            moved,
            ...distribution(snapshot)
        });
    }

    return trend;
};

/** يوزّع الوكلاء على شبكة داخل النطاق — خريطة حرارة للتأييد */
const buildCells = (points) => {
    const located = points.filter(p => p.lat !== null && p.lon !== null);
    if (located.length < 2) return [];

    // نُخشّن الشبكة مع قلّة الوكلاء: خليّة برأي واحد ليست بقعة، بل ضجيج.
    // الجذر التربيعي لنصف العدد يُبقي المتوسّط قرابة وكيلين في الخليّة.
    const divisions = clamp(Math.round(Math.sqrt(located.length / 2)), 2, 6);

    const lons = located.map(p => p.lon);
    const lats = located.map(p => p.lat);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);

    // هامش صغير حتى تقع النقطة القصوى داخل آخر خليّة لا خارجها
    const w = (maxLon - minLon) / divisions || 1e-6;
    const h = (maxLat - minLat) / divisions || 1e-6;

    const buckets = new Map();

    for (const p of located) {
        const cx = clamp(Math.floor((p.lon - minLon) / w), 0, divisions - 1);
        const cy = clamp(Math.floor((p.lat - minLat) / h), 0, divisions - 1);
        const key = `${cx}:${cy}`;
        if (!buckets.has(key)) buckets.set(key, { cx, cy, members: [] });
        buckets.get(key).members.push(p);
    }

    return [...buckets.values()].map(({ cx, cy, members }) => ({
        min_lon: minLon + cx * w,
        max_lon: minLon + (cx + 1) * w,
        min_lat: minLat + cy * h,
        max_lat: minLat + (cy + 1) * h,
        count: members.length,
        support: round1(supportIndex(members) * 100)
    }));
};

/** يربط كل وكيل بأقرب معلم حقيقي من OpenStreetMap، ثم يجمع حسب نوعه */
const buildNearby = (points, placeContext) => {
    const places = (placeContext?.places || []).filter(p => p.lat != null && p.lon != null);
    if (!places.length) return { by_kind: [], anchored: 0 };

    const groups = new Map();
    let anchored = 0;

    for (const p of points) {
        if (p.lat === null || p.lon === null) continue;

        let best = null;
        let bestD = Infinity;
        for (const place of places) {
            const d = haversineM(p, place);
            if (d < bestD) { bestD = d; best = place; }
        }
        if (!best) continue;

        p.nearest = { name: best.name, kind: best.kind, distance_m: Math.round(bestD) };
        anchored++;

        if (!groups.has(best.kind)) groups.set(best.kind, []);
        groups.get(best.kind).push(p);
    }

    const by_kind = [...groups.entries()]
        .map(([kind, members]) => ({
            kind,
            count: members.length,
            support: round1(supportIndex(members) * 100),
            example: members[0]?.nearest?.name || null
        }))
        .sort((a, b) => b.count - a.count);

    return { by_kind, anchored };
};

// ── الاحتمالية ───────────────────────────────────────────────
const forecast = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const simId = req.params.id;

        const simRes = await pool.query('SELECT * FROM helly_simulations WHERE id = $1', [simId]);
        if (!simRes.rows.length) return res.status(404).json({ error: 'المحاكاة غير موجودة' });
        const sim = simRes.rows[0];

        const [agentsRes, eventsRes] = await Promise.all([
            pool.query('SELECT * FROM helly_agents WHERE simulation_id = $1 ORDER BY id', [simId]),
            pool.query(
                `SELECT agent_id, round, kind, content, stance_after, shifted
                 FROM helly_events WHERE simulation_id = $1 ORDER BY id ASC`,
                [simId]
            )
        ]);

        const agents = agentsRes.rows.map(a => ({ ...a, influence: Number(a.influence) || 5 }));
        const events = eventsRes.rows;

        if (!agents.length) return res.status(400).json({ error: 'لا وكلاء في هذه المحاكاة' });
        if (!sim.current_round) {
            return res.status(400).json({ error: 'نفّذ جولة واحدة على الأقل قبل حساب الاحتمالية' });
        }

        const trend = buildTrend(agents, events, sim.current_round);

        // ١) الأساس: الميل المرجّح بالنفوذ، محوّلاً خطياً من [-1,+1] إلى [0,100]
        const index = supportIndex(agents);
        const base = (index + 1) / 2 * 100;

        // ٢) الزخم: كم تحرّك المؤشّر عبر آخر ثلاث جولات
        const last = trend[trend.length - 1];
        const earlier = trend[Math.max(0, trend.length - 4)];
        const momentum = last.support - earlier.support;       // نقاط على محور المؤشّر
        const momentumAdj = clamp(momentum * 0.35, -12, 12);   // أثره محدود عمداً

        const probability = Math.round(clamp(base + momentumAdj, 2, 98));

        // ── الثقة: كم نطمئنّ إلى الرقم أعلاه ──
        const total = agents.length;
        const dist = distribution(agents);

        const extremePos = (dist['مؤيّد بشدّة'] || 0) / total;
        const extremeNeg = (dist['معارض بشدّة'] || 0) / total;
        // كتلة على الطرفين مع تكافؤ بينهما = استقطاب حادّ
        const polarization = (extremePos + extremeNeg) * (1 - Math.abs(extremePos - extremeNeg));

        const lastMoved = last.moved || 0;
        const lastActive = events.filter(e => e.round === sim.current_round && e.agent_id).length || 1;
        const churn = clamp(lastMoved / lastActive, 0, 1);

        const sampleScore = clamp(total / 20, 0, 1);
        const roundsScore = clamp(sim.current_round / 6, 0, 1);
        const stabilityScore = 1 - churn;
        const consensusScore = 1 - clamp(polarization, 0, 1);

        const confidence = Math.round(100 * (
            0.25 * sampleScore + 0.25 * roundsScore + 0.30 * stabilityScore + 0.20 * consensusScore
        ));

        const direction = probability >= 55 ? 'up' : probability <= 45 ? 'down' : 'flat';
        const label = probability >= 75 ? 'ترجيح قوي للتأييد'
            : probability >= 58 ? 'ميل إلى التأييد'
            : probability > 42 ? 'انقسام متوازن'
            : probability > 25 ? 'ميل إلى المعارضة'
            : 'ترجيح قوي للمعارضة';

        // ── لماذا هذا الرقم: كل بند برقمه ومعادلته ──
        const breakdown = [
            {
                key: 'base',
                title: 'الميل المرجّح بالنفوذ',
                value: `${round1(base)}%`,
                effect: round1(base),
                kind: 'base',
                detail: `متوسّط مواقف ${total} وكيلاً مرجّحاً بنفوذ كلٍّ منهم = ${round1(index * 100) / 100}`
                    + ' على محور من ‎-1‎ (معارضة قصوى) إلى ‎+1‎ (تأييد أقصى)، مُحوّلاً خطياً إلى مئوية.'
            },
            {
                key: 'momentum',
                title: 'الزخم عبر الجولات',
                value: `${momentumAdj >= 0 ? '+' : ''}${round1(momentumAdj)} نقطة`,
                effect: round1(momentumAdj),
                kind: momentumAdj >= 0 ? 'positive' : 'negative',
                detail: `تحرّك المؤشّر من ${earlier.support} في الجولة ${earlier.round}`
                    + ` إلى ${last.support} في الجولة ${last.round}، أي ${momentum >= 0 ? '+' : ''}${round1(momentum)} نقطة.`
                    + ' يُضاف بمعامل 0.35 وبسقف ±12 نقطة حتى لا تطغى جولة واحدة على الصورة كلّها.'
            }
        ];

        const confidenceBreakdown = [
            {
                key: 'sample',
                title: 'حجم العيّنة',
                value: `${total} وكيلاً`,
                weight: '25%',
                score: Math.round(sampleScore * 100),
                detail: 'العشرون وكيلاً فأكثر تُعطي الدرجة الكاملة؛ ما دونها يُخفّض الثقة تناسبياً.'
            },
            {
                key: 'rounds',
                title: 'عمق المحاكاة',
                value: `${sim.current_round} جولة`,
                weight: '25%',
                score: Math.round(roundsScore * 100),
                detail: 'ستّ جولات فأكثر تكفي لاستقرار الرأي؛ الجولة أو الجولتان انطباع مبكّر لا أكثر.'
            },
            {
                key: 'stability',
                title: 'استقرار المواقف',
                value: `${lastMoved} من ${lastActive} تحوّلوا في الجولة الأخيرة`,
                weight: '30%',
                score: Math.round(stabilityScore * 100),
                detail: 'كثرة التحوّل في آخر جولة تعني أن الرأي لم يستقرّ بعد، فتنخفض الثقة.'
            },
            {
                key: 'consensus',
                title: 'درجة الاستقطاب',
                value: `${Math.round(polarization * 100)}%`,
                weight: '20%',
                score: Math.round(consensusScore * 100),
                detail: `${dist['مؤيّد بشدّة'] || 0} في أقصى التأييد مقابل ${dist['معارض بشدّة'] || 0} في أقصى المعارضة.`
                    + ' تكتّل متكافئ على الطرفين يجعل المتوسّط أقلّ تمثيلاً للواقع.'
            }
        ];

        // ── من حرّك الرأي فعلاً ──
        const influencers = [...agents]
            .sort((a, b) => b.influence - a.influence)
            .slice(0, 5)
            .map(a => ({
                id: a.id, name: a.name, stance: a.stance,
                influence: a.influence, place_role: a.place_role || null
            }));

        const movers = agents
            .filter(a => a.stance !== a.initial_stance)
            .map(a => ({
                id: a.id, name: a.name,
                from: a.initial_stance, to: a.stance,
                influence: a.influence, shifts: a.shifts,
                place_role: a.place_role || null
            }))
            .sort((a, b) => b.influence - a.influence)
            .slice(0, 8);

        // نقاط الانقلاب: الجولات التي قفز فيها المؤشّر، والأحداث المحقونة قبلها
        const injections = events.filter(e => e.kind === 'injection');
        const turningPoints = trend
            .slice(1)
            .map((t, i) => ({ ...t, delta: round1(t.support - trend[i].support) }))
            .filter(t => Math.abs(t.delta) >= 4)
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 4)
            .map(t => ({
                round: t.round,
                delta: t.delta,
                trigger: injections.find(e => e.round === t.round - 1 || e.round === t.round)?.content || null
            }));

        // ── الطبقة المكانية، إن كانت هذه محاكاة على الخريطة ──
        let spatial = null;
        const ring = sim.area?.ring;

        if (Array.isArray(ring) && ring.length >= 3) {
            const points = agents.map(a => ({
                id: a.id,
                name: a.name,
                stance: a.stance,
                initial_stance: a.initial_stance,
                influence: a.influence,
                shifts: a.shifts,
                place_role: a.place_role || null,
                last_said: a.last_said || null,
                lat: a.lat === null ? null : Number(a.lat),
                lon: a.lon === null ? null : Number(a.lon)
            }));

            const nearby = buildNearby(points, sim.place_context);
            const cells = buildCells(points);

            const sorted = [...cells].sort((a, b) => b.support - a.support);

            spatial = {
                ring,
                centroid: centroid(ring),
                area_km2: round1(polygonAreaKm2(ring)),
                place_name: sim.place_name || null,
                context: sim.place_context || null,
                labels: CATEGORY_LABELS,
                points,
                cells,
                by_kind: nearby.by_kind,
                anchored: nearby.anchored,
                hotspot: sorted[0] || null,
                coldspot: sorted[sorted.length - 1] || null
            };
        }

        res.json({
            simulation_id: Number(simId),
            topic: sim.topic,
            rounds_done: sim.current_round,
            total_rounds: sim.total_rounds,
            probability,
            confidence,
            direction,
            label,
            index: round1(index * 100) / 100,
            base: round1(base),
            momentum: round1(momentum),
            momentum_adj: round1(momentumAdj),
            polarization: Math.round(polarization * 100),
            distribution: dist,
            initial_distribution: distribution(agents, a => a.initial_stance),
            trend,
            breakdown,
            confidence_breakdown: confidenceBreakdown,
            drivers: { influencers, movers, turning_points: turningPoints },
            spatial
        });
    } catch (e) {
        console.error('Forecast error:', e);
        res.status(500).json({ error: 'تعذّر حساب الاحتمالية' });
    }
};

module.exports = { probeSpatial, captureStreet, searchPlace, forecast };
