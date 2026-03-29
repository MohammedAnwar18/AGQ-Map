import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToPushNotifications } from '../utils/pushSubscription';

const PushNotificationManager = () => {
    const { isAuthenticated, user } = useAuth();

    useEffect(() => {
        // Only subscribe if authenticated and in a safe context (e.g. browser with SW support)
        if (isAuthenticated && user) {
            // Wait a bit after login to show notification request
            const timer = setTimeout(() => {
                subscribeToPushNotifications();
            }, 3000);
            
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, user]);

    return null; // This component doesn't render anything
};

export default PushNotificationManager;
