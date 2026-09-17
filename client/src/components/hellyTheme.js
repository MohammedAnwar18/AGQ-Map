/* ألوان المواقف — مشتركة بين شاشة المحاكاة والطبقة المكانية،
   حتى تُقرأ النقطة على الخريطة بنفس لون بطاقة الوكيل بالضبط. */

export const STANCE_TONE = {
    'مؤيّد بشدّة': '#22c55e',
    'مؤيّد': '#4ade80',
    'محايد': '#94a3b8',
    'معارض': '#fb923c',
    'معارض بشدّة': '#ef4444'
};

export const STANCES = Object.keys(STANCE_TONE);

export const toneOf = (stance) => STANCE_TONE[stance] || '#94a3b8';
