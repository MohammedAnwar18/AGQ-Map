import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToPushNotifications } from '../utils/pushSubscription';

const PushNotificationManager = () => {
    const { isAuthenticated, user } = useAuth();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user) {
            // iOS and modern browsers block automatic prompts.
            // Check if push is supported and permission is not set
            if ('Notification' in window && Notification.permission === 'default') {
                const timer = setTimeout(() => setShowBanner(true), 2500);
                return () => clearTimeout(timer);
            } else if ('Notification' in window && Notification.permission === 'granted') {
                // If already granted, silent resubscribe ensures we have the latest token in DB
                subscribeToPushNotifications();
            }
        }
    }, [isAuthenticated, user]);

    const handleEnable = async () => {
        setShowBanner(false);
        // This is now triggered by explicit User Gesture (Click), allowing iOS to show the systemic prompt.
        await subscribeToPushNotifications();
    };

    if (!showBanner) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15, 20, 25, 0.95)',
            border: '2px solid #fbab15',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '12px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            width: '90%',
            maxWidth: '400px',
            direction: 'rtl',
            fontFamily: 'Tajawal, sans-serif'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🔔</span>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#fbab15' }}>تفعيل إشعارات الهاتف</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#ccc' }}>استلم تنبيهات فورية عند وصول رسالة أو طلب صداقة حتى وإن كان التطبيق مغلقاً!</p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <button 
                    onClick={handleEnable}
                    style={{
                        flex: 1,
                        background: '#fbab15',
                        color: '#000',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    تفعيل الآن
                </button>
                <button 
                    onClick={() => setShowBanner(false)}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        color: '#aaa',
                        border: '1px solid #555',
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    تجاهل
                </button>
            </div>
        </div>
    );
};

export default PushNotificationManager;
