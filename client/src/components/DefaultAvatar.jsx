import React from 'react';

const DefaultAvatar = ({ gender, size = 110, uid = 'u', style = {} }) => {
    const p = `av-${uid}`;

    if (gender === 'male') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                <defs>
                    <radialGradient id={`${p}-bg`} cx="50%" cy="30%" r="75%">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#1e1b4b" />
                    </radialGradient>
                    <radialGradient id={`${p}-skin`} cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#e8c9a0" />
                        <stop offset="100%" stopColor="#c8a070" />
                    </radialGradient>
                    <radialGradient id={`${p}-shoulder`} cx="50%" cy="10%" r="80%">
                        <stop offset="0%" stopColor="#3730a3" />
                        <stop offset="100%" stopColor="#1e1b4b" />
                    </radialGradient>
                </defs>

                {/* Background */}
                <circle cx="50" cy="50" r="50" fill={`url(#${p}-bg)`} />

                {/* Decorative rings */}
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

                {/* Geometric diamond accent top */}
                <polygon points="50,10 54,17 50,24 46,17" fill="rgba(129,140,248,0.5)" />
                <polygon points="50,12 53,17 50,22 47,17" fill="rgba(165,180,252,0.3)" />

                {/* Shoulders */}
                <ellipse cx="50" cy="97" rx="30" ry="20" fill={`url(#${p}-shoulder)`} />

                {/* Neck */}
                <rect x="44" y="63" width="12" height="11" rx="5" fill={`url(#${p}-skin)`} />

                {/* Head */}
                <ellipse cx="50" cy="52" rx="17" ry="19" fill={`url(#${p}-skin)`} />

                {/* Hair - short masculine style */}
                <path d="M33 48 Q33 29 50 28 Q67 29 67 48 Q65 36 50 35 Q35 36 33 48 Z" fill="#1a1a2e" />
                {/* Hair side fade */}
                <path d="M33 48 Q33 40 36 36 L36 44 Z" fill="#1a1a2e" />
                <path d="M67 48 Q67 40 64 36 L64 44 Z" fill="#1a1a2e" />

                {/* Eyes */}
                <ellipse cx="43.5" cy="50" rx="2.2" ry="2.5" fill="#5a3e28" />
                <ellipse cx="56.5" cy="50" rx="2.2" ry="2.5" fill="#5a3e28" />
                <circle cx="44.2" cy="49.2" r="0.8" fill="rgba(255,255,255,0.4)" />
                <circle cx="57.2" cy="49.2" r="0.8" fill="rgba(255,255,255,0.4)" />

                {/* Eyebrows */}
                <path d="M40.5 46.5 Q43.5 45 46.5 46.5" stroke="#5a3e28" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <path d="M53.5 46.5 Q56.5 45 59.5 46.5" stroke="#5a3e28" strokeWidth="1.2" fill="none" strokeLinecap="round" />

                {/* Nose */}
                <path d="M49 52 Q48 55 49.5 56 Q51 56 52 55 Q53 52 52 52" stroke="#b8926a" strokeWidth="0.8" fill="none" strokeLinecap="round" />

                {/* Smile */}
                <path d="M45.5 58.5 Q50 62 54.5 58.5" stroke="#b8926a" strokeWidth="1.5" fill="none" strokeLinecap="round" />

                {/* Small indigo glow dots */}
                <circle cx="20" cy="75" r="3" fill="rgba(99,102,241,0.2)" />
                <circle cx="80" cy="75" r="3" fill="rgba(99,102,241,0.2)" />
                <circle cx="15" cy="55" r="2" fill="rgba(99,102,241,0.15)" />
                <circle cx="85" cy="55" r="2" fill="rgba(99,102,241,0.15)" />
            </svg>
        );
    }

    if (gender === 'female') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                <defs>
                    <radialGradient id={`${p}-bg`} cx="50%" cy="30%" r="75%">
                        <stop offset="0%" stopColor="#9333ea" />
                        <stop offset="100%" stopColor="#4a044e" />
                    </radialGradient>
                    <radialGradient id={`${p}-skin`} cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#f5d5be" />
                        <stop offset="100%" stopColor="#e8b8a0" />
                    </radialGradient>
                    <radialGradient id={`${p}-hair`} cx="30%" cy="20%" r="80%">
                        <stop offset="0%" stopColor="#4a1a6b" />
                        <stop offset="100%" stopColor="#1a0a26" />
                    </radialGradient>
                    <radialGradient id={`${p}-shoulder`} cx="50%" cy="10%" r="80%">
                        <stop offset="0%" stopColor="#7e22ce" />
                        <stop offset="100%" stopColor="#4a044e" />
                    </radialGradient>
                </defs>

                {/* Background */}
                <circle cx="50" cy="50" r="50" fill={`url(#${p}-bg)`} />

                {/* Decorative rings */}
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

                {/* Star accent top */}
                <path d="M50 9 L51.8 14.2 L57.3 14.2 L52.8 17.4 L54.6 22.6 L50 19.4 L45.4 22.6 L47.2 17.4 L42.7 14.2 L48.2 14.2 Z"
                    fill="rgba(216,180,254,0.6)" />

                {/* Shoulders */}
                <ellipse cx="50" cy="97" rx="30" ry="20" fill={`url(#${p}-shoulder)`} />

                {/* Long hair - back layer */}
                <ellipse cx="50" cy="55" rx="22" ry="26" fill={`url(#${p}-hair)`} />

                {/* Neck */}
                <rect x="44" y="63" width="12" height="11" rx="5" fill={`url(#${p}-skin)`} />

                {/* Head */}
                <ellipse cx="50" cy="51" rx="16" ry="18" fill={`url(#${p}-skin)`} />

                {/* Hair - top */}
                <path d="M34 47 Q34 29 50 28 Q66 29 66 47 Q63 33 50 33 Q37 33 34 47 Z" fill={`url(#${p}-hair)`} />

                {/* Hair side curl left */}
                <path d="M34 47 Q28 55 30 68 Q32 62 35 55 Z" fill={`url(#${p}-hair)`} />
                {/* Hair side right */}
                <path d="M66 47 Q72 55 70 68 Q68 62 65 55 Z" fill={`url(#${p}-hair)`} />

                {/* Eyes */}
                <ellipse cx="43.5" cy="49" rx="2.5" ry="2.8" fill="#4a2e1a" />
                <ellipse cx="56.5" cy="49" rx="2.5" ry="2.8" fill="#4a2e1a" />
                <circle cx="44.3" cy="48" r="0.9" fill="rgba(255,255,255,0.45)" />
                <circle cx="57.3" cy="48" r="0.9" fill="rgba(255,255,255,0.45)" />

                {/* Eyelashes hint */}
                <path d="M41 46.5 Q43.5 44.5 46 46.5" stroke="#2a1a0a" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M54 46.5 Q56.5 44.5 59 46.5" stroke="#2a1a0a" strokeWidth="1" fill="none" strokeLinecap="round" />

                {/* Nose */}
                <path d="M49 51 Q48.5 54 50 55 Q51.5 55 52 54 Q52.5 51 52 51" stroke="#c4967a" strokeWidth="0.7" fill="none" strokeLinecap="round" />

                {/* Smile */}
                <path d="M46 57.5 Q50 61 54 57.5" stroke="#c4967a" strokeWidth="1.4" fill="none" strokeLinecap="round" />

                {/* Blush */}
                <circle cx="39" cy="52" r="4.5" fill="rgba(244,114,182,0.18)" />
                <circle cx="61" cy="52" r="4.5" fill="rgba(244,114,182,0.18)" />

                {/* Small sparkle dots */}
                <circle cx="20" cy="72" r="2.5" fill="rgba(216,180,254,0.25)" />
                <circle cx="80" cy="72" r="2.5" fill="rgba(216,180,254,0.25)" />
                <circle cx="16" cy="52" r="1.8" fill="rgba(216,180,254,0.18)" />
                <circle cx="84" cy="52" r="1.8" fill="rgba(216,180,254,0.18)" />
            </svg>
        );
    }

    // Neutral / unknown gender
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
            <defs>
                <radialGradient id={`${p}-bg`} cx="50%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#7c2d12" />
                </radialGradient>
                <radialGradient id={`${p}-skin`} cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#edd9b8" />
                    <stop offset="100%" stopColor="#d4b896" />
                </radialGradient>
                <radialGradient id={`${p}-shoulder`} cx="50%" cy="10%" r="80%">
                    <stop offset="0%" stopColor="#b45309" />
                    <stop offset="100%" stopColor="#7c2d12" />
                </radialGradient>
            </defs>

            {/* Background */}
            <circle cx="50" cy="50" r="50" fill={`url(#${p}-bg)`} />

            {/* Rings */}
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

            {/* Sparkle top */}
            <circle cx="50" cy="13" r="3" fill="rgba(253,230,138,0.6)" />
            <circle cx="50" cy="13" r="1.5" fill="rgba(253,230,138,0.9)" />
            <line x1="50" y1="8" x2="50" y2="18" stroke="rgba(253,230,138,0.4)" strokeWidth="0.8" />
            <line x1="45" y1="13" x2="55" y2="13" stroke="rgba(253,230,138,0.4)" strokeWidth="0.8" />

            {/* Shoulders */}
            <ellipse cx="50" cy="97" rx="30" ry="20" fill={`url(#${p}-shoulder)`} />

            {/* Neck */}
            <rect x="44" y="63" width="12" height="11" rx="5" fill={`url(#${p}-skin)`} />

            {/* Head */}
            <ellipse cx="50" cy="52" rx="17" ry="19" fill={`url(#${p}-skin)`} />

            {/* Hair - neutral medium */}
            <path d="M33 49 Q33 30 50 29 Q67 30 67 49 Q64 36 50 35 Q36 36 33 49 Z" fill="#5c3d1e" />

            {/* Eyes */}
            <ellipse cx="43.5" cy="50" rx="2.2" ry="2.5" fill="#4a3020" />
            <ellipse cx="56.5" cy="50" rx="2.2" ry="2.5" fill="#4a3020" />
            <circle cx="44.2" cy="49.2" r="0.8" fill="rgba(255,255,255,0.4)" />
            <circle cx="57.2" cy="49.2" r="0.8" fill="rgba(255,255,255,0.4)" />

            {/* Eyebrows */}
            <path d="M40.5 46.5 Q43.5 45 46.5 46.5" stroke="#4a3020" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M53.5 46.5 Q56.5 45 59.5 46.5" stroke="#4a3020" strokeWidth="1.2" fill="none" strokeLinecap="round" />

            {/* Nose */}
            <path d="M49 52 Q48 55 49.5 56 Q51 56 52 55 Q53 52 52 52" stroke="#b89060" strokeWidth="0.8" fill="none" strokeLinecap="round" />

            {/* Smile */}
            <path d="M45.5 58.5 Q50 62 54.5 58.5" stroke="#b89060" strokeWidth="1.5" fill="none" strokeLinecap="round" />

            {/* Glow dots */}
            <circle cx="20" cy="75" r="3" fill="rgba(251,191,36,0.2)" />
            <circle cx="80" cy="75" r="3" fill="rgba(251,191,36,0.2)" />
        </svg>
    );
};

export default DefaultAvatar;
