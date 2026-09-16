import React, { useId } from 'react';

/* ============================================================
   شعار HellyAgents

   لغة الاستخبارات: قوس مسح يجوب النطاق، وداخله مسارٌ يتفرّع من
   نقطة الحاضر إلى عدّة مستقبلات — أحدها مُرجّح فيتوهّج ذهبياً.
   العقد الزرقاء وكلاء تحت الرصد، والقوس السماوي عملية البحث الجارية.

   مرسوم بمنحنيات بيزييه لا بصورة، فيبقى حادّاً من ٢٠ بكسل في
   القائمة إلى ملء الشاشة — واختُبر بصرياً عند كل هذه الأحجام.
   ============================================================ */

const PALETTE = {
    bgTop: '#16243E',
    bgBottom: '#070C18',
    ring: '#16273F',
    scan: '#22D3EE',
    node: '#22D3EE',
    nodeSoft: '#7DD3FC',
    branch: '#2B4A70',
    predicted: '#FBAB15'
};

const HellyMark = ({ size = 40, rounded = true, className = '', ...rest }) => {
    // معرّفات فريدة لكل نسخة، وإلا تتداخل الأقنعة والتدرّجات عند التكرار
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

                <linearGradient id={`hbg-${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={PALETTE.bgTop} />
                    <stop offset="100%" stopColor={PALETTE.bgBottom} />
                </linearGradient>

                {/* القوس يخفت عند ذيله فيبدو ماسحاً لا ثابتاً */}
                <linearGradient id={`harc-${uid}`} x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor={PALETTE.scan} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={PALETTE.scan} />
                </linearGradient>
            </defs>

            <g clipPath={`url(#hm-${uid})`}>
                <rect width="64" height="64" fill={`url(#hbg-${uid})`} />

                {/* نطاق الرصد وقوس المسح */}
                <circle cx="32" cy="32" r="25" fill="none" stroke={PALETTE.ring} strokeWidth="6" />
                <path
                    d="M32 7 A25 25 0 0 1 57 32"
                    fill="none"
                    stroke={`url(#harc-${uid})`}
                    strokeWidth="6"
                    strokeLinecap="round"
                />

                {/* شجرة السيناريوهات — مصغّرة قليلاً لتتنفّس داخل النطاق */}
                <g transform="translate(4.8 4.8) scale(0.85)">
                    <path d="M17 44 C24 42 25 36 30 32" stroke={PALETTE.branch} strokeWidth="3.8" strokeLinecap="round" fill="none" />
                    <path d="M30 32 C37 27 40 24 45 18" stroke={PALETTE.predicted} strokeWidth="3.8" strokeLinecap="round" fill="none" />
                    <path d="M30 32 C38 31 42 32 47 33" stroke={PALETTE.branch} strokeWidth="3.8" strokeLinecap="round" fill="none" />
                    <path d="M30 32 C37 36 40 41 43 47" stroke={PALETTE.branch} strokeWidth="3.8" strokeLinecap="round" fill="none" />

                    <circle cx="17" cy="44" r="4.2" fill={PALETTE.node} />
                    <circle cx="30" cy="32" r="3.6" fill={PALETTE.nodeSoft} />
                    <circle cx="45" cy="18" r="5.2" fill={PALETTE.predicted} />
                    <circle cx="47.5" cy="33" r="3.4" fill={PALETTE.branch} />
                    <circle cx="43" cy="47" r="3.4" fill={PALETTE.branch} />
                </g>
            </g>
        </svg>
    );
};

export default HellyMark;
export { PALETTE as HELLY_PALETTE };
