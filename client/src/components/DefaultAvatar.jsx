import React from 'react';

const DefaultAvatar = ({ size = 110, style = {} }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            style={{
                borderRadius: '50%',
                display: 'block',
                flexShrink: 0,
                background: 'linear-gradient(145deg, #FFB829 0%, #F5A310 50%, #E08D05 100%)',
                boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                ...style
            }}
        >
            {/* Outer ring */}
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />

            {/* Crisp White User Silhouette */}
            <g fill="#FFFFFF">
                {/* Head */}
                <circle cx="50" cy="38" r="16" />
                {/* Shoulders */}
                <path d="M50 58 C32 58 18 69 15 86 C23 93 36 96 50 96 C64 96 77 93 85 86 C82 69 68 58 50 58 Z" />
            </g>
        </svg>
    );
};

export default DefaultAvatar;

