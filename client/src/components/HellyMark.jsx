import React, { useId } from 'react';

/* ============================================================
   شعار HellyAgents

   أربع شفرات عضوية تدور حول نواة واحدة: كل شفرة وكيل مستقلّ، وهي
   معاً تصنع حركة واحدة — وهذا هو معنى المحرّك.

   اللوحة ترابية دافئة بلغة التجريد الحديث، والنواة حلقة بقلبٍ فاتح.
   مرسوم بمنحنيات بيزييه لا بصورة، فيبقى حادّاً من ٢٠ بكسل في القائمة
   إلى ملء الشاشة، واختُبر عند كل هذه الأحجام.
   ============================================================ */

const PALETTE = {
    sandLight: '#E5C69F',
    sandDeep: '#CBA074',
    cream: '#F2E5CE',
    ochre: '#C08A2E',
    brown: '#6F5236',
    tan: '#E3B786',
    core: '#5A4129'
};

// شفرة واحدة تُستنسخ بأربع زوايا حول المركز (32, 32)
const BLADE = 'M32 33 C28 24 31 13 41 8 C48 14 48 27 38 32 C36 33 34 33.6 32 33 Z';

const HellyMark = ({ size = 40, rounded = true, className = '', ...rest }) => {
    // معرّفات فريدة لكل نسخة، وإلا تتداخل الأقنعة عند تكرار الشعار في الصفحة
    const uid = useId().replace(/:/g, '');

    return (
        <svg
            viewBox="0 0 64 64"
            width={size}
            height={size}
            className={className}
            role="img"
            aria-label="HellyAgents"
            {...rest}
        >
            <defs>
                <clipPath id={`hm-${uid}`}>
                    <rect width="64" height="64" rx={rounded ? 19 : 0} />
                </clipPath>
                <linearGradient id={`hg-${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={PALETTE.sandLight} />
                    <stop offset="100%" stopColor={PALETTE.sandDeep} />
                </linearGradient>
            </defs>

            <g clipPath={`url(#hm-${uid})`}>
                <rect width="64" height="64" fill={`url(#hg-${uid})`} />

                <path d={BLADE} fill={PALETTE.cream} transform="rotate(10 32 32)" />
                <path d={BLADE} fill={PALETTE.ochre} transform="rotate(100 32 32)" />
                <path d={BLADE} fill={PALETTE.brown} transform="rotate(190 32 32)" />
                <path d={BLADE} fill={PALETTE.tan} transform="rotate(280 32 32)" />

                {/* النواة: حلقة داكنة بقلب فاتح */}
                <circle cx="32" cy="32" r="5" fill={PALETTE.core} />
                <circle cx="32" cy="32" r="1.9" fill={PALETTE.cream} />
            </g>
        </svg>
    );
};

export default HellyMark;
export { PALETTE as HELLY_PALETTE };
