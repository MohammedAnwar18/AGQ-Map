import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useWorld, WORLD_BOUNDS, live, TILE_TYPES } from './worldStore';
import { ASSETS, TILE } from './assets';
import { field, heightAt, TERRAIN_SPAN, TERRAIN_GRID } from './terrain';
import { cityPlan, DISTRICTS, LANE, SIDEWALK } from './city';

/* ============================================================
   خريطة العالم

   مرسومة على لوحة 2D لا بعناصر DOM، ومحدَّثة في حلقة rAF خاصّة بها
   تقرأ موضع المشاهد من `live` مباشرة. لذلك تتحرّك العلامة معك ستّين
   مرّة في الثانية بينما لا يُعاد رسم مكوّن React ولا مرّة واحدة.

   السحب يعمل على نفس اللوحة: نبحث عن أقرب عقدة لموضع الضغط، فإن
   وُجدت سُحبت، وإلا انتقل المشاهد إلى تلك النقطة.
   ============================================================ */

const EXTENT = WORLD_BOUNDS + 20;   // نصف عرض المساحة المعروضة بالمتر
const HIT_RADIUS = 11;              // بكسل — نصف قطر التقاط العقدة

const TONE = {
    nature: '#4FA85C',
    build: '#E06C75',
    vehicle: '#61AFEF',
    street: '#E5C07B',
    road: '#8A93A3',
    terrain: '#7FB069',
    custom: '#38BDF8'
};

const TILE_FILL = {
    road_straight: '#4A515D', road_cross: '#4A515D', road_turn: '#4A515D',
    road_tee: '#4A515D', crosswalk: '#565E6B',
    sidewalk: '#B4AD9E', plaza: '#C2BAA9',
    grass_patch: '#4E8437', dirt_patch: '#9A7B55', water: '#3D89A8'
};

const groupOf = (type) => {
    if (type?.startsWith('custom:')) return 'custom';
    return ASSETS[type]?.group || 'nature';
};

/**
 * يرسم التضاريس على لوحة منفصلة.
 *
 * خريطة تظليل لا خطوط كنتور: كل خليّة تُلوَّن بارتفاعها وميلها، فتُقرأ
 * التلّة تلّةً والحفرة حفرة بنظرة واحدة. تُعاد الرسم عند تغيّر الأرض
 * وحده — لا ستّين مرّة في الثانية — ثم تُنسخ كصورة جاهزة في كل إطار.
 */
const paintTerrain = (canvas, waterOn, waterLevel) => {
    const N = 160;
    canvas.width = N;
    canvas.height = N;

    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(N, N);
    const data = image.data;

    const half = TERRAIN_SPAN / 2;
    const step = TERRAIN_SPAN / (N - 1);

    for (let j = 0; j < N; j++) {
        const z = -half + j * step;

        for (let i = 0; i < N; i++) {
            const x = -half + i * step;
            const h = heightAt(x, z);

            // إضاءة تلّية: نُنير من الشمال الغربي كما تفعل الخرائط
            const shade = (heightAt(x - step, z - step) - h) * 22;
            const k = (j * N + i) * 4;

            if (waterOn && h < waterLevel) {
                const depth = Math.min(1, (waterLevel - h) / 5);
                data[k] = 34 + (1 - depth) * 60;
                data[k + 1] = 110 + (1 - depth) * 70;
                data[k + 2] = 150 + (1 - depth) * 55;
            } else {
                const t = Math.max(-1, Math.min(1, h / 12));
                data[k] = 46 + t * 70 - shade;
                data[k + 1] = 92 + t * 52 - shade;
                data[k + 2] = 44 + t * 40 - shade;
            }
            data[k + 3] = 255;
        }
    }

    ctx.putImageData(image, 0, 0);
};

const MiniMap = ({ compact = false }) => {
    const canvasRef = useRef(null);
    const boxRef = useRef(null);
    const dragRef = useRef(null);
    const viewRef = useRef({ size: 0, dpr: 1 });

    const [readout, setReadout] = useState({ x: 0, z: 0 });
    const reliefRef = useRef(null);
    const reliefRev = useRef(-1);

    const placed = useWorld(s => s.placed);
    const selectedId = useWorld(s => s.selectedId);
    const placementType = useWorld(s => s.placementType);
    const mode = useWorld(s => s.mode);
    const gridSize = useWorld(s => s.environment.gridSize || TILE);
    const cityCfg = useWorld(s => s.city);
    const terrainRevision = useWorld(s => s.terrainRevision);

    const city = useMemo(() => cityPlan(cityCfg), [cityCfg]);
    const water = useWorld(s => s.terrain.water);
    const waterLevel = useWorld(s => s.terrain.waterLevel);

    const moveItem = useWorld(s => s.moveItem);
    const setCameraTarget = useWorld(s => s.setCameraTarget);
    const select = useWorld(s => s.select);
    const place = useWorld(s => s.place);

    // أحدث القيم للحلقة: الرسم يقرأ من مرجع لا من إغلاق قديم
    const dataRef = useRef({ placed, selectedId, gridSize, mode, water, waterLevel, terrainRevision, city });
    dataRef.current = { placed, selectedId, gridSize, mode, water, waterLevel, terrainRevision, city };

    // ── تحويل الإحداثيات ──
    const toPx = useCallback((v, size) => ((v + EXTENT) / (EXTENT * 2)) * size, []);
    const toWorld = useCallback((px, size) => (px / size) * EXTENT * 2 - EXTENT, []);

    // ── الرسم ──
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        reliefRef.current = document.createElement('canvas');
        let raf = 0;

        const fit = () => {
            const box = boxRef.current.getBoundingClientRect();
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const size = Math.max(120, Math.floor(box.width));

            if (viewRef.current.size !== size || viewRef.current.dpr !== dpr) {
                canvas.width = size * dpr;
                canvas.height = size * dpr;
                canvas.style.height = `${size}px`;
                viewRef.current = { size, dpr };
            }
            return viewRef.current;
        };

        const draw = () => {
            const { size, dpr } = fit();
            const { placed: items, selectedId: sel, gridSize: grid } = dataRef.current;
            const { water: hasWater, waterLevel: wl } = dataRef.current;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, size, size);

            // الأرض
            ctx.fillStyle = '#16311f';
            ctx.fillRect(0, 0, size, size);

            // التضاريس: لوحة مساعدة تُرسم عند تغيّر الأرض فقط، ثم
            // تُمدّد هنا في كل إطار — نسخة صورة أرخص من ٢٥ ألف بكسل
            if (field.touched && reliefRef.current) {
                const signature = `${field.revision}_${hasWater ? 1 : 0}_${wl}`;
                if (reliefRev.current !== signature) {
                    reliefRev.current = signature;
                    paintTerrain(reliefRef.current, hasWater, wl);
                }

                // المساحة المنحوتة أصغر من المعروض، فنضعها في موضعها
                const span = (TERRAIN_SPAN / (EXTENT * 2)) * size;
                const origin = (size - span) / 2;

                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(reliefRef.current, origin, origin, span, span);
            }

            // المدينة: الشوارع أولاً ثم المربّعات ملوّنة بحيّها. هذه
            // هي الخريطة التي يُقرأ منها المكان — لا نقاط متفرّقة
            const plan = dataRef.current.city;
            if (plan) {
                const m = (v) => toPx(v, size);
                const w = (v) => (v / (EXTENT * 2)) * size;

                ctx.fillStyle = '#2C333D';
                ctx.fillRect(m(-plan.span / 2), m(-plan.span / 2), w(plan.span), w(plan.span));

                for (const b of plan.blocks) {
                    const tone = DISTRICTS[b.district]?.tone || '#7FB069';
                    ctx.fillStyle = tone;
                    ctx.globalAlpha = 0.62;
                    ctx.fillRect(m(b.x0), m(b.z0), w(b.x1 - b.x0), w(b.z1 - b.z0));
                    ctx.globalAlpha = 1;
                }

                // خطّ منتصف رفيع على كل شارع — يُقرأ شبكةً لا فراغاً
                ctx.strokeStyle = 'rgba(255,255,255,.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (const road of plan.roads) {
                    if (road.axis === 'x') {
                        ctx.moveTo(m(road.at), m(-plan.span / 2));
                        ctx.lineTo(m(road.at), m(plan.span / 2));
                    } else {
                        ctx.moveTo(m(-plan.span / 2), m(road.at));
                        ctx.lineTo(m(plan.span / 2), m(road.at));
                    }
                }
                ctx.stroke();
            }

            // شبكة البناء — بنفس مقاس البلاطة، فيُقرأ الالتقاط بصرياً
            const step = (grid / (EXTENT * 2)) * size;
            if (step > 5 && !plan) {
                ctx.strokeStyle = 'rgba(255,255,255,.055)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let v = (size / 2) % step; v < size; v += step) {
                    ctx.moveTo(Math.round(v) + 0.5, 0); ctx.lineTo(Math.round(v) + 0.5, size);
                    ctx.moveTo(0, Math.round(v) + 0.5); ctx.lineTo(size, Math.round(v) + 0.5);
                }
                ctx.stroke();
            }

            // المحوران
            ctx.strokeStyle = 'rgba(255,255,255,.14)';
            ctx.beginPath();
            ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
            ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
            ctx.stroke();

            const tileSide = (TILE / (EXTENT * 2)) * size;

            // ١) البلاطات أولاً — أرضية يقف عليها الباقي
            for (const item of items) {
                if (!TILE_TYPES.has(item.type)) continue;
                const s = tileSide * (item.scale || 1);
                ctx.fillStyle = TILE_FILL[item.type] || '#4A515D';
                ctx.fillRect(toPx(item.x, size) - s / 2, toPx(item.z, size) - s / 2, s, s);
            }

            // ٢) ثم المجسمات
            for (const item of items) {
                if (TILE_TYPES.has(item.type)) continue;

                const x = toPx(item.x, size);
                const y = toPx(item.z, size);
                const isSel = item.id === sel;
                const r = (isSel ? 5 : 3.6) * (item.scale > 1.4 ? 1.25 : 1);

                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fillStyle = TONE[groupOf(item.type)] || '#94a3b8';
                ctx.fill();

                ctx.lineWidth = isSel ? 2.4 : 1;
                ctx.strokeStyle = isSel ? '#FBAB15' : 'rgba(0,0,0,.55)';
                ctx.stroke();
            }

            // ٣) المشاهد: قرص ومخروط رؤية يدور مع نظرك
            const px = toPx(live.x, size);
            const py = toPx(live.z, size);

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(live.heading);

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 26, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
            ctx.closePath();
            ctx.fillStyle = 'rgba(251,171,21,.26)';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, -8.5);
            ctx.lineTo(5.5, 5);
            ctx.lineTo(0, 2.2);
            ctx.lineTo(-5.5, 5);
            ctx.closePath();
            ctx.fillStyle = '#FBAB15';
            ctx.fill();
            ctx.lineWidth = 1.3;
            ctx.strokeStyle = '#0a0f1c';
            ctx.stroke();
            ctx.restore();

            raf = requestAnimationFrame(draw);
        };

        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [toPx]);

    // ── التفاعل ──
    const pointFrom = useCallback((e) => {
        const box = canvasRef.current.getBoundingClientRect();
        const size = box.width;
        const px = Math.min(size, Math.max(0, e.clientX - box.left));
        const py = Math.min(size, Math.max(0, e.clientY - box.top));
        return { px, py, size, x: toWorld(px, size), z: toWorld(py, size) };
    }, [toWorld]);

    const onDown = (e) => {
        const { px, py, size, x, z } = pointFrom(e);
        const { placed: items } = dataRef.current;

        // أقرب عقدة للضغطة — البلاطات تُلتقط أيضاً لكن بأولوية أدنى
        let hit = null;
        let best = HIT_RADIUS;

        for (const item of items) {
            const d = Math.hypot(toPx(item.x, size) - px, toPx(item.z, size) - py);
            const reach = TILE_TYPES.has(item.type) ? HIT_RADIUS * 0.65 : HIT_RADIUS;
            if (d < reach && d <= best) { best = d; hit = item; }
        }

        if (placementType) {
            place(placementType, x, z);
        } else if (hit) {
            dragRef.current = hit.id;
            select(hit.id);
        } else {
            setCameraTarget(+x.toFixed(2), +z.toFixed(2));
        }

        canvasRef.current.setPointerCapture(e.pointerId);
        setReadout({ x: Math.round(x), z: Math.round(z) });
    };

    const onMove = (e) => {
        const { x, z } = pointFrom(e);
        setReadout({ x: Math.round(x), z: Math.round(z) });
        if (dragRef.current) moveItem(dragRef.current, x, z);
    };

    const onUp = (e) => {
        dragRef.current = null;
        try { canvasRef.current.releasePointerCapture(e.pointerId); } catch { /* تُرك أصلاً */ }
    };

    return (
        <div className="we-map">
            <div className={`we-mapbox${placementType ? ' is-placing' : ''}`} ref={boxRef}>
                <canvas
                    ref={canvasRef}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                />

                <span className="we-map-scale">
                    <i style={{ width: `${(gridSize / (EXTENT * 2)) * 100}%` }} />
                    {gridSize} م
                </span>

                <span className="we-map-coord">{readout.x} · {readout.z}</span>
                <span className="we-map-north">ش</span>
            </div>

            {!compact && (
                <p className="we-note">
                    {placementType
                        ? 'وضع الوضع مفعّل — انقر الخريطة أو المشهد لإسقاط نسخة.'
                        : mode === 'walk'
                            ? 'العلامة الذهبية أنت، ومخروطها اتجاه نظرك. انقر أي نقطة لتقفز إليها عند العودة للتحرير.'
                            : 'انقر فراغاً لنقل الكاميرا، واسحب أي عقدة لنقل مجسمها.'}
                </p>
            )}
        </div>
    );
};

export default MiniMap;
