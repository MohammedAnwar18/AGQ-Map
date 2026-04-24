import React, { useState, useEffect } from 'react';

const PwaInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isPermissionsGranted, setIsPermissionsGranted] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        // Catch the native PWA install prompt event
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            console.log('PWA Install Prompt Event Captured');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Logic to check if location and notifications are granted
        const checkPermissions = async () => {
            try {
                // Check Geolocation Permission
                let geoGranted = false;
                if (navigator.permissions) {
                    const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
                    geoGranted = geoStatus.state === 'granted';
                }

                // Check Notification Permission
                const notificationGranted = Notification.permission === 'granted';

                if (geoGranted && notificationGranted) {
                    setIsPermissionsGranted(true);
                } else {
                    setIsPermissionsGranted(false);
                }
            } catch (error) {
                console.error("Error checking permissions:", error);
                // Fallback: If query fails, check only Notification since geolocation is harder to check silently
                if (Notification.permission === 'granted') {
                    setIsPermissionsGranted(true);
                }
            }
        };

        // Poll permissions every 2 seconds to detect changes after user allows them
        const interval = setInterval(checkPermissions, 2000);
        checkPermissions();

        // Check if already in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) {
            console.log('App is already running in standalone mode');
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        // Only show if:
        // 1. Prompt is available (Chrome/Android mostly)
        // 2. Permissions are granted (user has allowed location/notifs)
        // 3. Not already in standalone mode
        // 4. Not already dismissed in this session
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const isDismissed = sessionStorage.getItem('pwa_install_dismissed');

        if (deferredPrompt && isPermissionsGranted && !isStandalone && !isDismissed) {
            // Delay slightly to not overwhelm user immediately after permissions
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [deferredPrompt, isPermissionsGranted]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        
        setIsInstalling(true);
        
        // Trigger the native browser prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        if (outcome === 'accepted') {
            console.log('User accepted the PWA install');
            setShowPrompt(false);
        } else {
            console.log('User dismissed the PWA install');
            setIsInstalling(false);
        }
        
        // Clear the deferred prompt so it can't be used again
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        sessionStorage.setItem('pwa_install_dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '92%',
            maxWidth: '420px',
            background: 'linear-gradient(145deg, #111827, #1f2937)',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(251, 171, 21, 0.15)',
            zIndex: 1000000,
            direction: 'rtl',
            fontFamily: 'Tajawal, sans-serif',
            animation: 'pwaSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
        }}>
            {/* Glossy Background Effect */}
            <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '150px',
                height: '150px',
                background: 'radial-gradient(circle, rgba(251, 171, 21, 0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
            }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: '#fbab15',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 16px rgba(251, 171, 21, 0.3)',
                    flexShrink: 0
                }}>
                    <img src="/logo.png" alt="PalNovaa" style={{ width: '45px', height: '45px', objectFit: 'contain' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '19px', color: '#fff', fontWeight: '800' }}>ثبّت تطبيق بالنوفا 🚀</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.4' }}>
                        احصل على تجربة أسرع، إشعارات فورية، ووصول مباشر من شاشتك الرئيسية!
                    </p>
                </div>
                <button 
                    onClick={handleDismiss}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: '#9ca3af',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        alignSelf: 'flex-start'
                    }}
                >
                    ✕
                </button>
            </div>

            <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '16px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px' }}>✅</span>
                    <span style={{ fontSize: '13px', color: '#e5e7eb' }}>تم تفعيل الصلاحيات بنجاح</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px' }}>⚡</span>
                    <span style={{ fontSize: '13px', color: '#e5e7eb' }}>جاهز للتثبيت الفوري</span>
                </div>
            </div>

            <button
                onClick={handleInstall}
                disabled={isInstalling}
                style={{
                    width: '100%',
                    background: '#fbab15',
                    color: '#000',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '14px',
                    fontSize: '16px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(251, 171, 21, 0.4)'
                }}
            >
                {isInstalling ? (
                    <>
                        <div className="install-spinner"></div>
                        جاري التثبيت...
                    </>
                ) : (
                    <>
                        تثبيت الآن
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                    </>
                )}
            </button>

            <style>{`
                @keyframes pwaSlideUp {
                    0% { transform: translate(-50%, 120%) scale(0.9); opacity: 0; }
                    60% { transform: translate(-50%, -10%) scale(1.02); opacity: 1; }
                    100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
                }
                .install-spinner {
                    width: 18px;
                    height: 18px;
                    border: 3px solid rgba(0,0,0,0.1);
                    border-top: 3px solid #000;
                    border-radius: 50%;
                    animation: pwaSpin 1s linear infinite;
                }
                @keyframes pwaSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                button:active {
                    transform: scale(0.98);
                }
            `}</style>
        </div>
    );
};

export default PwaInstallPrompt;
