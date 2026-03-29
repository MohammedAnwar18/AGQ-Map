import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Map from './pages/Map';
import StreetMap from './pages/StreetMap';
import AdminDashboard from './pages/AdminDashboard';
import AdminUserDetails from './pages/AdminUserDetails';
import LegalPages from './pages/LegalPages';

import OfflinePage from './components/OfflinePage';
import PushNotificationManager from './components/PushNotificationManager';
import './index.css';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem'
            }}>
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)' }}>جاري التحميل...</p>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem'
            }}>
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)' }}>جاري التحميل...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    if (user?.role !== 'admin') {
        alert('Access Denied: Admin privileges required');
        return <Navigate to="/map" />;
    }

    return children;
};

const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem'
            }}>
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)' }}>جاري التحميل...</p>
            </div>
        );
    }

    return isAuthenticated ? <Navigate to="/map" /> : children;
};

function App() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Native-like Splash Screen Removal
        const hideSplash = () => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.classList.add('fade-out');
                document.body.classList.remove('splash-active');
                // Remove from DOM after transition
                setTimeout(() => {
                    splash.style.display = 'none';
                }, 600);
            }
        };

        // Delay slightly for perceived performance (mimics native app initialization)
        const timer = setTimeout(hideSplash, 1200);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearTimeout(timer);
        };
    }, []);

    if (!isOnline) {
        return <OfflinePage />;
    }

    return (
        <AuthProvider>
            <PushNotificationManager />
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <Login />
                            </PublicRoute>
                        }
                    />
                    <Route
                        path="/map"
                        element={
                            <ProtectedRoute>
                                <Map />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/streets"
                        element={
                            <ProtectedRoute>
                                <StreetMap />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin"
                        element={
                            <AdminRoute>
                                <AdminDashboard />
                            </AdminRoute>
                        }
                    />
                    <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserDetails /></AdminRoute>} />
                    
                    {/* Legal Routes */}
                    <Route path="/terms" element={<LegalPages type="terms" />} />
                    <Route path="/privacy" element={<LegalPages type="privacy" />} />

                    <Route path="/" element={<Navigate to="/map" />} />
                    <Route path="*" element={<OfflinePage />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
