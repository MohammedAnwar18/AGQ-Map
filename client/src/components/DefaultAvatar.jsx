import React from 'react';

const DefaultAvatar = ({ gender, size = 110, uid = 'u', style = {} }) => {
    const p = `av-${uid}`;

    if (gender === 'male') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                <defs>
                    <clipPath id={`${p}-clip`}>
                        <circle cx="50" cy="50" r="45" />
                    </clipPath>
                </defs>

                {/* Background */}
                <circle cx="50" cy="50" r="50" fill="#ffffff" />
                
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#026a9e" strokeWidth="5" />
                
                {/* Silhouette clipped inside the circle */}
                <g fill="#026a9e" clipPath={`url(#${p}-clip)`}>
                    {/* Head */}
                    <path d="M50,47 C55.5,47 59.5,42.5 59.5,35 C59.5,27.5 55.5,20.5 50,20.5 C44.5,20.5 40.5,27.5 40.5,35 C40.5,42.5 44.5,47 50,47 Z" />
                    {/* Hair */}
                    <path d="M37.5,30 C37,20 42.5,15 50,15 C57.5,15 63,20 62.5,30 C61.5,25.5 58.5,19 50,19 C41.5,19 38.5,25.5 37.5,30 Z" />
                    {/* Neck */}
                    <path d="M44.5,46 L44.5,58 L55.5,58 L55.5,46 Z" />
                    {/* Shoulders */}
                    <path d="M22,86 C22,68 34,58 42,56 L58,56 C66,58 78,68 78,86 L78,96 L22,96 Z" />
                </g>
            </svg>
        );
    }

    if (gender === 'female') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                <defs>
                    <clipPath id={`${p}-clip`}>
                        <circle cx="50" cy="50" r="45" />
                    </clipPath>
                </defs>
                
                {/* Background */}
                <circle cx="50" cy="50" r="50" fill="#ffffff" />
                
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#c42f6d" strokeWidth="5" />
                
                {/* Silhouette clipped inside the circle */}
                <g fill="#c42f6d" clipPath={`url(#${p}-clip)`}>
                    {/* Head */}
                    <path d="M50,47 C55.5,47 59.5,42.5 59.5,36 C59.5,29.5 55.5,22 50,22 C44.5,22 40.5,29.5 40.5,36 C40.5,42.5 44.5,47 50,47 Z" />
                    {/* Hair */}
                    <path d="M36,36 C35,24 41,16 50,16 C59,16 65,24 64,36 C63,47 61.5,49 61.5,54 C61.5,49 62,44 61,38 C60,30 56.5,21 50,21 C43.5,21 40,30 39,38 C38,44 38.5,49 38.5,54 C38.5,49 37,47 36,36 Z" />
                    {/* Neck */}
                    <path d="M44.5,45 L44.5,59 L55.5,59 L55.5,45 Z" />
                    {/* Shoulders */}
                    <path d="M24,86 C24,70 35,61 43,59 L57,59 C65,61 76,70 76,86 L76,96 L24,96 Z" />
                </g>
            </svg>
        );
    }

    // Neutral / unknown gender
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
            <defs>
                <clipPath id={`${p}-clip`}>
                    <circle cx="50" cy="50" r="45" />
                </clipPath>
            </defs>
            
            {/* Background */}
            <circle cx="50" cy="50" r="50" fill="#ffffff" />
            
            {/* Outer Ring */}
            <circle cx="50" cy="50" r="45" fill="none" stroke="#64748b" strokeWidth="5" />
            
            {/* Silhouette clipped inside the circle */}
            <g fill="#64748b" clipPath={`url(#${p}-clip)`}>
                {/* Head */}
                <path d="M50,47 C55.5,47 59.5,42.5 59.5,35 C59.5,27.5 55.5,20.5 50,20.5 C44.5,20.5 40.5,27.5 40.5,35 C40.5,42.5 44.5,47 50,47 Z" />
                {/* Generic Hair / Cap shape */}
                <path d="M37.5,32 C37,22 42.5,17 50,17 C57.5,17 63,22 62.5,32 C61.5,27.5 58.5,21 50,21 C41.5,21 38.5,27.5 37.5,32 Z" />
                {/* Neck */}
                <path d="M44.5,46 L44.5,58 L55.5,58 L55.5,46 Z" />
                {/* Shoulders */}
                <path d="M22,86 C22,68 34,58 42,56 L58,56 C66,58 78,68 78,86 L78,96 L22,96 Z" />
            </g>
        </svg>
    );
};

export default DefaultAvatar;
