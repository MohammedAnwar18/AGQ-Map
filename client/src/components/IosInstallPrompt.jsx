import React, { useState, useEffect } from 'react';

const IosInstallPrompt = () => {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Detect iOS
        const isIos = () => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            return /iphone|ipad|ipod/.test(userAgent);
        };

        // Detect if already installed (standalone mode)
        const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

        // Debug: Remove comment below to trigger forcefully on non-iOS environments
        // if (!isInStandaloneMode()) {
        if (isIos() && !isInStandaloneMode()) {
            const hasDismissed = sessionStorage.getItem('ios_install_dismissed');
            if (!hasDismissed) {
                // Show prompt shortly after loading
                const timer = setTimeout(() => {
                    setShowPrompt(true);
                }, 3000);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const handleDismiss = () => {
        setShowPrompt(false);
        // Save choice to session storage only, so it appears again on next login/reload
        sessionStorage.setItem('ios_install_dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '25px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-secondary, #1e293b)',
            color: 'var(--text-primary, #ffffff)',
            padding: '18px 20px',
            borderRadius: '20px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-color, #334155)',
            zIndex: 999999, // Super high index to be above maps etc
            width: '90%',
            maxWidth: '340px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'inherit',
            animation: 'slideUpBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
            <button onClick={handleDismiss} style={{
                position: 'absolute', top: '12px', right: '15px',
                background: 'transparent', border: 'none', color: '#94a3b8',
                fontSize: '18px', cursor: 'pointer', outline: 'none'
            }}>✕</button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '5px' }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M16.96,18.06c-0.78,1.14-1.61,2.27-2.85,2.3c-1.21,0.03-1.62-0.71-2.99-0.71c-1.37,0-1.81,0.68-2.95,0.71 c-1.2,0-1.95-1.04-2.73-2.18c-1.61-2.32-2.84-6.55-1.19-9.42c0.82-1.42,2.26-2.33,3.84-2.36c1.17-0.03,2.27,0.78,2.99,0.78 c0.72,0,2.05-1,3.46-0.85c1.47,0.06,2.8,0.71,3.54,1.82c-3.08,1.86-2.58,6.23,0.5,7.41C18.17,16.48,17.6,17.33,16.96,18.06z M14.61,4.64c0.63-0.76,1.06-1.83,0.94-2.89c-0.93,0.04-2.04,0.62-2.69,1.41C12.3,3.85,11.8,4.96,11.96,5.99 C12.98,6.07,14.03,5.43,14.61,4.64z" />
                </svg>
                تثبيت التطبيق
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                للحصول على تجربة أسرع، أضف PalNovaa إلى شاشتك الرئيسية بخطوات سريعة:
            </p>
            
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: 'rgba(0,0,0,0.3)', padding: '15px 10px', borderRadius: '14px',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }}>
                {/* Step 1: Share */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#0a84ff' }}>
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 'bold' }}>مشاركة</span>
                </div>

                <div style={{ color: '#475569', fontSize: '1.2rem', fontWeight: 'bold' }}>❯</div>

                {/* Step 2: Scroll Down */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fbab15' }}>
                        <line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 'bold' }}>عرض المزيد</span>
                </div>

                <div style={{ color: '#475569', fontSize: '1.2rem', fontWeight: 'bold' }}>❯</div>

                {/* Step 3: Add to Home */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffffff' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 'bold' }}>إضافة</span>
                </div>
            </div>

            {/* Down-pointing arrow */}
            <div style={{
                position: 'absolute', bottom: '-12px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent',
                borderTop: '12px solid var(--bg-secondary, #1e293b)'
            }}></div>

            <style>{`
                @keyframes slideUpBounce {
                    0% { transform: translate(-50%, 100%); opacity: 0; }
                    50% { transform: translate(-50%, -5%); opacity: 1; }
                    100% { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default IosInstallPrompt;
