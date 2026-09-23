import React, { useRef, useEffect, useMemo } from 'react';

import { distance2D } from './indoorGeo';

/* ============================================================
   المخطّط من فوق

   الكاميرا تُري ما أمامك، وهذا يُري الشكل كلّه: أين أنت من المبنى،
   وإلى أين يمضي المسار بعد المنعطف الذي لا تراه.

   مرسوم على لوحة لا بعناصر DOM: عشرات النقاط والمسارات تتحدّث ستّين
   مرّة في الثانية مع كل خطوة، وإعادة بناء عناصرها في كل مرّة هدر.
   ============================================================ */

const TONE = {
    place: '#4ADE80',
    entrance: '#38BDF8',
    junction: '#64748B',
    stairs: '#C084FC',
    elevator: '#F472B6',
    exit: '#FB7185'
};

const PADDING = 26;

/** يحسب التحويل من الأمتار إلى البكسل بحيث يتّسع كل شيء */
const fitTransform = (points, width, height) => {
    if (!points.length) {
        return { scale: 6, ox: width / 2, oz: height / 2, min: { x: 0, z: 0 } };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
    }

    // هامش من مترين حول كل شيء، وحدّ أدنى للمدى كي لا تنفجر النسبة
    // حين تكون كل النقاط في مكان واحد
    const spanX = Math.max(6, maxX - minX + 4);
    const spanZ = Math.max(6, maxZ - minZ + 4);

    const scale = Math.min(
        (width - PADDING * 2) / spanX,
        (height - PADDING * 2) / spanZ
    );

    return {
        scale,
        ox: width / 2 - ((minX + maxX) / 2) * scale,
        // z الشمالي يصعد في العالم وينزل على الشاشة، فتُقلب إشارته
        oz: height / 2 + ((minZ + maxZ) / 2) * scale
    };
};

const FloorPlan = ({
    nodes = [],
    edges = [],
    route = null,
    you = null,
    heading = 0,
    selected = null,
    onPick,
    compact = false
}) => {
    const canvasRef = useRef(null);
    const boxRef = useRef(null);
    const viewRef = useRef(null);

    // أحدث القيم للحلقة: الرسم يقرأ من مرجع لا من إغلاق قديم
    const data = useRef({ nodes, edges, route, you, heading, selected });
    data.current = { nodes, edges, route, you, heading, selected };

    const all = useMemo(() => {
        const points = [...nodes];
        for (const edge of edges) if (Array.isArray(edge.path)) points.push(...edge.path);
        return points;
    }, [nodes, edges]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const box = boxRef.current;
        if (!canvas || !box) return undefined;

        let raf = 0;

        const draw = () => {
            const rect = box.getBoundingClientRect();
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const width = Math.max(120, rect.width);
            const height = Math.max(120, rect.height);

            if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
            }

            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            const { nodes: ns, edges: es, route: rt, you: me, heading: hd, selected: sel } = data.current;

            const t = fitTransform(all.length ? all : (me ? [me] : []), width, height);
            viewRef.current = { ...t, width, height };

            const px = (p) => ({ x: t.ox + p.x * t.scale, y: t.oz - p.z * t.scale });

            // خلفية وشبكة بالمتر — بها تُقرأ المسافات
            ctx.fillStyle = '#0B1220';
            ctx.fillRect(0, 0, width, height);

            const step = t.scale >= 14 ? 1 : t.scale >= 6 ? 5 : 10;
            if (t.scale * step > 8) {
                ctx.strokeStyle = 'rgba(255,255,255,.055)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let v = t.ox % (t.scale * step); v < width; v += t.scale * step) {
                    ctx.moveTo(Math.round(v) + 0.5, 0);
                    ctx.lineTo(Math.round(v) + 0.5, height);
                }
                for (let v = t.oz % (t.scale * step); v < height; v += t.scale * step) {
                    ctx.moveTo(0, Math.round(v) + 0.5);
                    ctx.lineTo(width, Math.round(v) + 0.5);
                }
                ctx.stroke();
            }

            // ١) الممرّات
            const byId = new Map(ns.map(n => [n.id, n]));
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (const edge of es) {
                const line = edge.path?.length > 1
                    ? edge.path
                    : [byId.get(edge.from), byId.get(edge.to)].filter(Boolean);
                if (line.length < 2) continue;

                ctx.strokeStyle = 'rgba(148,163,184,.5)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                line.forEach((p, i) => {
                    const q = px(p);
                    return i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
                });
                ctx.stroke();
            }

            // ٢) الطريق المختار فوقها
            if (rt?.length > 1) {
                ctx.strokeStyle = 'rgba(56,189,248,.25)';
                ctx.lineWidth = 11;
                ctx.beginPath();
                rt.forEach((p, i) => {
                    const q = px(p);
                    return i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
                });
                ctx.stroke();

                ctx.strokeStyle = '#38BDF8';
                ctx.lineWidth = 4;
                ctx.stroke();
            }

            // ٣) النقاط
            for (const node of ns) {
                const q = px(node);
                const isSel = node.id === sel;
                const junction = node.kind === 'junction';
                const r = junction ? 3.5 : isSel ? 8 : 6;

                ctx.beginPath();
                ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
                ctx.fillStyle = TONE[node.kind] || TONE.place;
                ctx.fill();

                ctx.lineWidth = isSel ? 3 : 1.5;
                ctx.strokeStyle = isSel ? '#FBAB15' : 'rgba(3,8,18,.7)';
                ctx.stroke();

                if (!junction && !compact && t.scale > 4) {
                    ctx.font = '600 11px "IBM Plex Sans Arabic", system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = 'rgba(241,245,249,.92)';
                    ctx.fillText(node.name.slice(0, 18), q.x, q.y - r - 5);
                }
            }

            // ٤) أنت — قرص ومخروط رؤية يدور مع نظرك
            if (me) {
                const q = px(me);

                ctx.save();
                ctx.translate(q.x, q.y);
                ctx.rotate(((hd || 0) * Math.PI) / 180);

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, 26, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
                ctx.closePath();
                ctx.fillStyle = 'rgba(251,171,21,.22)';
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(0, -9);
                ctx.lineTo(6, 6);
                ctx.lineTo(0, 2.5);
                ctx.lineTo(-6, 6);
                ctx.closePath();
                ctx.fillStyle = '#FBAB15';
                ctx.fill();
                ctx.lineWidth = 1.4;
                ctx.strokeStyle = '#0B1220';
                ctx.stroke();
                ctx.restore();
            }

            // ٥) شريط المقياس — الخريطة بلا مقياس صورة لا خريطة
            if (!compact) {
                const bar = t.scale * step;
                ctx.fillStyle = 'rgba(11,18,32,.82)';
                ctx.fillRect(10, height - 26, bar + 44, 18);
                ctx.fillStyle = '#94A3B8';
                ctx.fillRect(16, height - 18, bar, 2.5);
                ctx.font = '700 10px system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`${step} م`, 20 + bar, height - 14);
            }

            raf = requestAnimationFrame(draw);
        };

        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [all, compact]);

    // ── اللمس: أقرب نقطة ──
    const onPointerDown = (event) => {
        if (!onPick) return;

        const view = viewRef.current;
        const box = canvasRef.current.getBoundingClientRect();
        if (!view) return;

        const px = event.clientX - box.left;
        const py = event.clientY - box.top;

        const world = {
            x: (px - view.ox) / view.scale,
            z: (view.oz - py) / view.scale
        };

        let best = null;
        let bestD = 22 / view.scale;   // ٢٢ بكسل من التسامح، محوّلة إلى أمتار

        for (const node of data.current.nodes) {
            const d = distance2D(node, world);
            if (d < bestD) { bestD = d; best = node; }
        }

        if (best) onPick(best.id, best);
    };

    return (
        <div className={`fp${compact ? ' is-compact' : ''}`} ref={boxRef}>
            <canvas ref={canvasRef} onPointerDown={onPointerDown} />
        </div>
    );
};

export default FloorPlan;
