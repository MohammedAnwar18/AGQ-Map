// Coffee Lab — original wordmark/seal (NOT a recreation of the supplied logo)
// We render a circular monogram seal with "CL" mark + arabic subtitle.

const CLSeal = ({ size = 64, ring = true, dark = false }) => {
  const fg = dark ? '#F5F1EA' : 'var(--ink)';
  const accent = 'var(--accent)';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {ring && (
        <>
          <circle cx="50" cy="50" r="48" stroke={fg} strokeWidth="1" opacity="0.4"/>
          <circle cx="50" cy="50" r="44" stroke={fg} strokeWidth="1.2"/>
        </>
      )}
      {/* abstract flask + bean monogram */}
      <path d="M38 30v14c0 6-6 8-6 14a8 8 0 0 0 8 8h20a8 8 0 0 0 8-8c0-6-6-8-6-14V30"
            stroke={fg} strokeWidth="2" strokeLinecap="round"/>
      <path d="M34 30h28" stroke={fg} strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="56" cy="56" rx="5" ry="6" fill={accent}/>
      <path d="M56 52c-1 2-1 6 0 8" stroke={fg} strokeWidth="1" opacity="0.7"/>
      {/* tick marks - lab measurement */}
      <line x1="40" y1="38" x2="42" y2="38" stroke={fg} strokeWidth="1"/>
      <line x1="40" y1="42" x2="44" y2="42" stroke={fg} strokeWidth="1"/>
      <line x1="40" y1="46" x2="42" y2="46" stroke={fg} strokeWidth="1"/>
    </svg>
  );
};

// Full wordmark used in header
const CLWordmark = ({ dark = false }) => {
  const fg = dark ? '#F5F1EA' : 'var(--ink)';
  return (
    <div className="cl-wordmark" style={{ color: fg }}>
      <CLSeal size={42} ring={true} dark={dark}/>
      <div className="cl-wordmark-text">
        <div className="cl-wordmark-en">COFFEE LAB</div>
        <div className="cl-wordmark-ar">مختبر القهوة</div>
      </div>
    </div>
  );
};

window.CLSeal = CLSeal;
window.CLWordmark = CLWordmark;
