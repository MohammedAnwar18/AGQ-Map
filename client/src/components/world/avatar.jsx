import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { Part, Surface } from './primitives';
import { heightAt } from './terrain';
import { remotes, fullAppearance } from './gameStore';

/* ============================================================
   الأفاتار

   جسد واحد يُستعمل في ثلاثة مواضع: أنت حين تراه من الخلف، واللاعبون
   الآخرون في عالمك، والمارّة. مفصول عن المشهد لأنه يحمل الآن مظهراً
   يختاره صاحبه — لون قميص وبنطال وشعر وبشرة وطول — لا ألواناً
   عشوائية من بذرة.

   والحركة فيه واحدة: ساق تتقدّم وذراع مقابلة ترجع، وتردّد يتبع
   السرعة. هي وحدها ما يجعل الكتلة المتحرّكة شخصاً يمشي.
   ============================================================ */

/**
 * جسد الأفاتار.
 *
 * المراجع تُمرَّر من الخارج: صاحب الجسد هو من يحرّكه — المشهد يعرف
 * سرعته، والجسد يعرف شكله فقط.
 */
export const AvatarBody = ({ look, legL, legR, armL, armR }) => {
    const a = useMemo(() => fullAppearance(look), [look]);

    return (
        <group scale={a.height}>
            {/* الساقان: المحور عند الورك والقطعة معلّقة تحته */}
            {[[legL, -0.11], [legR, 0.11]].map(([ref, x], i) => (
                <group key={i} ref={ref} position={[x, 0.82, 0]}>
                    <mesh position={[0, -0.36, 0]} castShadow>
                        <boxGeometry args={[0.17, 0.72, 0.19]} />
                        <Surface color={a.pants} />
                    </mesh>
                    <mesh position={[0, -0.74, 0.04]} castShadow>
                        <boxGeometry args={[0.19, 0.1, 0.29]} />
                        <Surface color="#2A2E36" roughness={0.6} />
                    </mesh>
                </group>
            ))}

            <mesh position={[0, 1.13, 0]} castShadow>
                <boxGeometry args={[0.43, 0.62, 0.25]} />
                <Surface color={a.shirt} />
            </mesh>

            {[[armL, -0.29], [armR, 0.29]].map(([ref, x], i) => (
                <group key={i} ref={ref} position={[x, 1.4, 0]}>
                    <mesh position={[0, -0.26, 0]} castShadow>
                        <boxGeometry args={[0.13, 0.52, 0.14]} />
                        <Surface color={a.shirt} />
                    </mesh>
                    <mesh position={[0, -0.57, 0]} castShadow>
                        <boxGeometry args={[0.12, 0.13, 0.13]} />
                        <Surface color={a.skin} />
                    </mesh>
                </group>
            ))}

            <mesh position={[0, 1.49, 0]} castShadow>
                <cylinderGeometry args={[0.07, 0.08, 0.1, 7]} />
                <Surface color={a.skin} />
            </mesh>
            <mesh position={[0, 1.66, 0]} castShadow>
                <boxGeometry args={[0.26, 0.28, 0.25]} />
                <Surface color={a.skin} />
            </mesh>
            <mesh position={[0, 1.78, -0.01]} castShadow>
                <boxGeometry args={[0.28, 0.13, 0.27]} />
                <Surface color={a.hair} roughness={0.95} />
            </mesh>

            {a.bag && (
                <mesh position={[0, 1.16, -0.2]} castShadow>
                    <boxGeometry args={[0.32, 0.4, 0.16]} />
                    <Surface color="#4C566A" />
                </mesh>
            )}
        </group>
    );
};

// ── لافتة الاسم ─────────────────────────────────────────────

/**
 * اسم يطفو فوق الرأس.
 *
 * مرسوم على لوحة ثم مُلصق على مستطيل يواجه الكاميرا دائماً. الخطّ
 * الحقيقي (troika) يجرّ حزمة كاملة لأجل سطر واحد، واللوحة تكفي.
 */
const nameTextures = new Map();

const nameTexture = (text) => {
    if (nameTextures.has(text)) return nameTextures.get(text);
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.font = '600 58px "IBM Plex Sans Arabic", "Tajawal", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const width = Math.min(480, ctx.measureText(text).width + 56);

    ctx.fillStyle = 'rgba(10, 15, 28, .82)';
    ctx.beginPath();
    ctx.roundRect((512 - width) / 2, 22, width, 84, 42);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, .55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#F1F5F9';
    ctx.fillText(text, 256, 66);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    nameTextures.set(text, texture);
    return texture;
};

const NameTag = ({ text, y = 2.1 }) => {
    const ref = useRef();
    const texture = useMemo(() => nameTexture(text), [text]);

    useFrame(({ camera }) => {
        // تواجه الكاميرا حول المحور الرأسي وحده: لافتة تميل مع نظرك
        // لأعلى تبدو معلّقة في الهواء لا فوق رأس
        const g = ref.current;
        if (!g) return;
        g.rotation.y = Math.atan2(camera.position.x - g.parent.position.x, camera.position.z - g.parent.position.z);
    });

    if (!texture) return null;

    return (
        <group ref={ref} position={[0, y, 0]}>
            <mesh>
                <planeGeometry args={[1.9, 0.48]} />
                <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
            </mesh>
        </group>
    );
};

// ── لاعب بعيد ───────────────────────────────────────────────

const SMOOTH = 0.12;   // ثانية — زمن اللحاق بالموضع الجديد

/**
 * لاعب آخر في نفس العالم.
 *
 * النبضة تصل كل ثانية، فالموضع يقفز. نستوفي نحوه بمعدّل ثابت لا
 * نقفز إليه، ونشتقّ سرعته من مقدار ما قطعه — فتتحرّك ساقاه بقدر
 * ما يسير فعلاً، ويقف ساكناً حين يقف.
 */
const RemotePlayer = ({ code }) => {
    const group = useRef();
    const legL = useRef();
    const legR = useRef();
    const armL = useRef();
    const armR = useRef();

    const phase = useRef(0);
    const entry = remotes.get(code);

    useFrame((_, dt) => {
        const g = group.current;
        const data = remotes.get(code);
        if (!g || !data) return;

        const step = Math.min(dt, 0.1);
        const k = 1 - Math.exp(-step / SMOOTH);

        const beforeX = g.position.x;
        const beforeZ = g.position.z;

        g.position.x += (data.x - g.position.x) * k;
        g.position.z += (data.z - g.position.z) * k;
        g.position.y = heightAt(g.position.x, g.position.z);

        // أقصر فرق زاوي: بلا هذا يدور دورة كاملة عند عبور ‎±π‎
        let turn = data.heading - g.rotation.y;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        g.rotation.y += turn * k;

        const moved = Math.hypot(g.position.x - beforeX, g.position.z - beforeZ) / step;
        const walking = moved > 0.25;

        phase.current += walking ? step * Math.min(moved, 7) * 1.7 : 0;

        const swing = walking ? Math.sin(phase.current) * 0.62 : 0;
        if (legL.current) legL.current.rotation.x = swing;
        if (legR.current) legR.current.rotation.x = -swing;
        if (armL.current) armL.current.rotation.x = -swing * 0.72;
        if (armR.current) armR.current.rotation.x = swing * 0.72;
    });

    if (!entry) return null;

    return (
        <group ref={group} position={[entry.x, heightAt(entry.x, entry.z), entry.z]} rotation={[0, entry.heading, 0]}>
            <AvatarBody look={entry.appearance} legL={legL} legR={legR} armL={armL} armR={armR} />
            <NameTag text={entry.name} />
        </group>
    );
};

/**
 * كل من معي في هذا العالم.
 *
 * القائمة تُعاد من النبضة، والمواضع تُكتب في ‎remotes‎ خارج React —
 * فلا يُعاد رسم أحد إلا حين يدخل لاعب أو يخرج.
 */
export const RemotePlayers = ({ codes }) => (
    <group>
        {codes.map(code => <RemotePlayer key={code} code={code} />)}
    </group>
);

// ── جسدي أنا ────────────────────────────────────────────────

/**
 * جسدك كما يراه غيرك — ويراه ظلُّك.
 *
 * مرسوم دائماً حتى في منظور الشخص الأوّل: الرأس خلف الكاميرا فلا
 * يُرى، لكن ظلّه على الأرض يُرى — وغياب الظلّ يجعلك تطفو.
 */
export const SelfAvatar = ({ look, positionRef, walking }) => {
    const group = useRef();
    const legL = useRef();
    const legR = useRef();
    const armL = useRef();
    const armR = useRef();
    const phase = useRef(0);

    useFrame((_, dt) => {
        const g = group.current;
        if (!g) return;

        const p = positionRef.current;
        g.position.set(p.x, heightAt(p.x, p.z), p.z);
        g.rotation.y = p.heading;

        phase.current += walking.current ? Math.min(dt, 0.1) * 9 : 0;
        const swing = walking.current ? Math.sin(phase.current) * 0.62 : 0;

        if (legL.current) legL.current.rotation.x = swing;
        if (legR.current) legR.current.rotation.x = -swing;
        if (armL.current) armL.current.rotation.x = -swing * 0.72;
        if (armR.current) armR.current.rotation.x = swing * 0.72;
    });

    return (
        <group ref={group}>
            <AvatarBody look={look} legL={legL} legR={legR} armL={armL} armR={armR} />
        </group>
    );
};

export default AvatarBody;
