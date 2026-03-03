import React from 'react';

export function LocationMarker({ size = 48, className = "" }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            width={size}
            height={size}
            className={className}
            fill="none"
            aria-hidden="true"
        >
            <defs>
                {/* Urban body gradient */}
                <linearGradient id="urbanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                </linearGradient>

                {/* Moving shine */}
                <linearGradient id="shineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    <animateTransform
                        attributeName="gradientTransform"
                        type="translate"
                        from="-1 0"
                        to="1 0"
                        dur="2.5s"
                        repeatCount="indefinite"
                    />
                </linearGradient>

                {/* Soft glow */}
                <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Marker body */}
            <path
                d="M32 2C20.4 2 11 11.4 11 23c0 15.8 21 39 21 39s21-23.2 21-39C53 11.4 43.6 2 32 2z"
                fill="url(#urbanGradient)"
                filter="url(#softGlow)"
            />

            {/* Shine overlay */}
            <path
                d="M32 2C20.4 2 11 11.4 11 23c0 15.8 21 39 21 39s21-23.2 21-39C53 11.4 43.6 2 32 2z"
                fill="url(#shineGradient)"
                opacity="0.35"
            />

            {/* Inner dot */}
            <circle cx="32" cy="23" r="7" fill="#e5f2ff" opacity="0.95" />

            {/* Pulse ring */}
            <circle
                cx="32"
                cy="23"
                r="7"
                fill="none"
                stroke="#7dd3fc"
                strokeWidth="1.5"
            >
                <animate
                    attributeName="r"
                    from="7"
                    to="11"
                    dur="2s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    from="0.8"
                    to="0"
                    dur="2s"
                    repeatCount="indefinite"
                />
            </circle>
        </svg>
    );
}
