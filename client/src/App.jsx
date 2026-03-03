import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Map from './pages/Map';
import AdminDashboard from './pages/AdminDashboard';
import AdminUserDetails from './pages/AdminUserDetails';

import OfflinePage from './components/OfflinePage';
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

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOnline) {
        return <OfflinePage />;
    }

    return (
        <AuthProvider>
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
                        path="/admin"
                        element={
                            <AdminRoute>
                                <AdminDashboard />
                            </AdminRoute>
                        }
                    />
                    <Route
                        path="/admin/users/:userId"
                        element={
                            <AdminRoute>
                                <AdminUserDetails />
                            </AdminRoute>
                        }
                    />

                    <Route path="/" element={<Navigate to="/map" />} />
                    <Route path="*" element={<OfflinePage />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
