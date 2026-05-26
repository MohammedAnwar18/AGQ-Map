import React from 'react';

const DefaultAvatar = ({ gender, size = 110, uid = 'u', style = {} }) => {
    const p = `av-${uid}`;

    if (gender === 'male') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                <defs>
                    <radialGradient id={`${p}-bg`} cx="50%" cy="30%" r="75%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="60%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#020617" />
                    </radialGradient>
                    <linearGradient id={`${p}-glow`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id={`${p}-silhouette`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e2e8f0" />
                        <stop offset="40%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id={`${p}-border`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#1e40af" />
                    </linearGradient>
                </defs>

                {/* Background */}
                <circle cx="50" cy="50" r="50" fill={`url(#${p}-bg)`} />
                
                {/* Glowing Aura */}
                <circle cx="50" cy="55" r="30" fill={`url(#${p}-glow)`} filter="blur(5px)" />
                
                {/* Tech Accent Grid Lines */}
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                
                {/* Male Silhouette */}
                <g>
                    {/* Shoulders / Suit */}
                    <path d="M 22,85 C 22,68 35,58 43,56 L 45,63 C 46,65 48,66 50,66 C 52,66 54,65 55,63 L 57,56 C 65,58 78,68 78,85 L 78,100 L 22,100 Z" fill={`url(#${p}-silhouette)`} opacity="0.95" />
                    
                    {/* V-Neck Shirt Opening */}
                    <path d="M 44,58 L 50,68 L 56,58 Z" fill="#0f172a" />
                    
                    {/* Suit Collar Highlights */}
                    <path d="M 32,72 L 43,56 L 45,63 Z" fill="rgba(255,255,255,0.15)" />
                    <path d="M 68,72 L 57,56 L 55,63 Z" fill="rgba(255,255,255,0.15)" />
                    
                    {/* Neck */}
                    <path d="M 43,45 L 43,58 C 43,62 57,62 57,58 L 57,45 Z" fill={`url(#${p}-silhouette)`} opacity="0.9" />
                    
                    {/* Head & Hair */}
                    <path d="M 50,18 C 41.5,18 38.5,24 38.5,33 C 38.5,42 43.5,46.5 50,46.5 C 56.5,46.5 61.5,42 61.5,33 C 61.5,24 58.5,18 50,18 Z" fill={`url(#${p}-silhouette)`} />
                    
                    {/* Hair (Sleek, Modern, Professional Haircut) */}
                    <path d="M 37.5,31 C 37,21 42.5,15.5 50,15.5 C 57.5,15.5 63,21 62.5,31 C 61.5,26 58.5,19.5 50,19.5 C 41.5,19.5 38.5,26 37.5,31 Z" fill="#1e293b" />
                    
                    {/* Sleek Glasses or Minimalist Feature hint */}
                    <circle cx="44" cy="31" r="3" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                    <circle cx="56" cy="31" r="3" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                    <line x1="47" y1="31" x2="53" y2="31" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                </g>
                
                {/* Premium Inner Border Ring */}
                <circle cx="50" cy="50" r="47" fill="none" stroke={`url(#${p}-border)`} strokeWidth="1.5" opacity="0.6" />
            </svg>
        );
    }

    if (gender === 'female') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                <defs>
                    <radialGradient id={`${p}-bg`} cx="50%" cy="30%" r="75%">
                        <stop offset="0%" stopColor="#2e1065" />
                        <stop offset="60%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#020617" />
                    </radialGradient>
                    <linearGradient id={`${p}-glow`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f472b6" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id={`${p}-silhouette`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fae8ff" />
                        <stop offset="40%" stopColor="#f5d0fe" />
                        <stop offset="100%" stopColor="#d8b4fe" />
                    </linearGradient>
                    <linearGradient id={`${p}-border`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f472b6" />
                        <stop offset="100%" stopColor="#7e22ce" />
                    </linearGradient>
                </defs>

                {/* Background */}
                <circle cx="50" cy="50" r="50" fill={`url(#${p}-bg)`} />
                
                {/* Glowing Aura */}
                <circle cx="50" cy="55" r="30" fill={`url(#${p}-glow)`} filter="blur(5px)" />
                
                {/* Tech Accent Grid Lines */}
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(244, 114, 182, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                
                {/* Female Silhouette */}
                <g>
                    {/* Hair Back Layer */}
                    <path d="M 33,36 C 31,48 31,58 33,65 C 36,65 37,58 37,50 Z" fill="#3b0764" />
                    <path d="M 67,36 C 69,48 69,58 67,65 C 64,65 63,58 63,50 Z" fill="#3b0764" />

                    {/* Shoulders / Blouse */}
                    <path d="M 23,85 C 23,70 35,60 43,58 L 45,64 C 46,66 48,67 50,67 C 52,67 54,66 55,64 L 57,58 C 65,60 77,70 77,85 L 77,100 L 23,100 Z" fill={`url(#${p}-silhouette)`} opacity="0.95" />
                    
                    {/* V-Neck Blouse Opening */}
                    <path d="M 44,59 L 50,67 L 56,59 Z" fill="#0f172a" />
                    
                    {/* Blouse Highlights */}
                    <path d="M 33,73 C 38,65 43,58 43,58 Z" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                    <path d="M 67,73 C 62,65 57,58 57,58 Z" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                    
                    {/* Neck */}
                    <path d="M 44,45 L 44,57 C 44,61 56,61 56,57 L 56,45 Z" fill={`url(#${p}-silhouette)`} opacity="0.9" />
                    
                    {/* Head & Hair */}
                    <path d="M 50,19.5 C 42.5,19.5 39.5,25 39.5,33.5 C 39.5,41.5 44,45.5 50,45.5 C 56,45.5 60.5,41.5 60.5,33.5 C 60.5,25 57.5,19.5 50,19.5 Z" fill={`url(#${p}-silhouette)`} />
                    
                    {/* Hair (Sleek, Modern, Professional Style) */}
                    <path d="M 37,34 C 36,22 41,16 50,16 C 59,16 64,22 63,34 C 62,44 61,46 61,50 C 61,45 61.5,41 61,35 C 60,28 56.5,21.5 50,21.5 C 43.5,21.5 40,28 39,35 C 38.5,41 39,45 39,50 C 39,46 38,44 37,34 Z" fill="#3b0764" />
                    
                    {/* Sleek Minimalist Eyeglasses hint */}
                    <circle cx="44.5" cy="31.5" r="2.8" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                    <circle cx="55.5" cy="31.5" r="2.8" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                    <line x1="47.3" y1="31.5" x2="52.7" y2="31.5" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                </g>
                
                {/* Premium Inner Border Ring */}
                <circle cx="50" cy="50" r="47" fill="none" stroke={`url(#${p}-border)`} strokeWidth="1.5" opacity="0.6" />
            </svg>
        );
    }

    // Neutral / unknown gender
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
            <defs>
                <radialGradient id={`${p}-bg`} cx="50%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#451a03" />
                    <stop offset="60%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <linearGradient id={`${p}-glow`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`${p}-silhouette`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fef3c7" />
                    <stop offset="40%" stopColor="#fde68a" />
                    <stop offset="100%" stopColor="#fcd34d" />
                </linearGradient>
                <linearGradient id={`${p}-border`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
            </defs>

            {/* Background */}
            <circle cx="50" cy="50" r="50" fill={`url(#${p}-bg)`} />
            
            {/* Glowing Aura */}
            <circle cx="50" cy="55" r="30" fill={`url(#${p}-glow)`} filter="blur(5px)" />
            
            {/* Tech Accent Grid Lines */}
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(251, 191, 36, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            
            {/* Neutral Silhouette */}
            <g>
                {/* Shoulders */}
                <path d="M 24,85 C 24,70 36,60 44,58 L 46,64 C 47,66 48.5,67 50,67 C 51.5,67 53,66 54,64 L 56,58 C 64,60 76,70 76,85 L 76,100 L 24,100 Z" fill={`url(#${p}-silhouette)`} opacity="0.95" />
                
                {/* V-Neck Shirt Opening */}
                <path d="M 45,59 L 50,66 L 55,59 Z" fill="#0f172a" />
                
                {/* Neck */}
                <path d="M 44,46 L 44,57 C 44,61 56,61 56,57 L 56,46 Z" fill={`url(#${p}-silhouette)`} opacity="0.9" />
                
                {/* Head */}
                <path d="M 50,20 C 42.5,20 39.5,25.5 39.5,34 C 39.5,42 44,46 50,46 C 56,46 60.5,42 60.5,34 C 60.5,25.5 57.5,20 50,20 Z" fill={`url(#${p}-silhouette)`} />
                
                {/* Abstract tech elements */}
                <path d="M 49,27 L 51,27 M 48,32 L 52,32 M 49,37 L 51,37" stroke="rgba(15,23,42,0.4)" strokeWidth="1.2" strokeLinecap="round" />
            </g>
            
            {/* Premium Inner Border Ring */}
            <circle cx="50" cy="50" r="47" fill="none" stroke={`url(#${p}-border)`} strokeWidth="1.5" opacity="0.6" />
        </svg>
    );
};

export default DefaultAvatar;
