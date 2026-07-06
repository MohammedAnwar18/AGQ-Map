import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
const Login = React.lazy(() => import('./pages/Login'));
const Map = React.lazy(() => import('./pages/Map'));
const StreetMap = React.lazy(() => import('./pages/StreetMap'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminUserDetails = React.lazy(() => import('./pages/AdminUserDetails'));
const LegalPages = React.lazy(() => import('./pages/LegalPages'));
const Support = React.lazy(() => import('./pages/Support'));
const PublishedView = React.lazy(() => import('./pages/PublishedView'));
const ARView = React.lazy(() => import('./pages/ARView'));
const ARWorkspace = React.lazy(() => import('./pages/ARWorkspace'));
const VirtualTourMap = React.lazy(() => import('./pages/VirtualTourMap'));
const DigitalLetterView = React.lazy(() => import('./pages/DigitalLetterView'));
const GraduationEvent = React.lazy(() => import('./pages/GraduationEvent'));
import WeddingInvite from './pages/WeddingInvite';

import OfflinePage from './components/OfflinePage';
import PushNotificationManager from './components/PushNotificationManager';
import IosInstallPrompt from './components/IosInstallPrompt';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import SplashLoading from './components/SplashLoading';
import ProfileSetupModal from './components/ProfileSetupModal';
import './index.css';

const OnboardingManager = () => {
    const { user, isAuthenticated } = useAuth();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user && !user.profile_picture) {
            const seen = localStorage.getItem(`profile_setup_shown_${user.id}`);
            if (!seen) setShow(true);
        }
    }, [isAuthenticated, user]);

    const handleClose = () => {
        if (user && user.id) {
            localStorage.setItem(`profile_setup_shown_${user.id}`, '1');
        }
        setShow(false);
    };

    if (!show) return null;
    return <ProfileSetupModal onClose={handleClose} />;
};

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    const searchParams = new URLSearchParams(window.location.search);
    const hasSharedItem = searchParams.has('shopId') || searchParams.has('facilityId');

    if (hasSharedItem) {
        return children;
    }

    if (loading) return <SplashLoading />;

    return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) return <SplashLoading />;

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

    if (loading) return <SplashLoading />;

    return isAuthenticated ? <Navigate to="/map" /> : children;
};

function App() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Splash Screen Logic (Restored to original 1.8s)
        const timer = setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.classList.add('fade-out');
                document.body.classList.remove('splash-active');
                setTimeout(() => {
                    splash.style.display = 'none';
                }, 600);
            }
        }, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearTimeout(timer);
        };
    }, []);



    return (
        <BrowserRouter>
            <React.Suspense fallback={<SplashLoading />}>
                <Routes>
                    {/* 🌐 Public routes - completely outside AuthProvider */}
                    <Route path="/p/:slug" element={<PublishedView />} />
                    <Route path="/l/:slug" element={<DigitalLetterView />} />
                    <Route path="/enas-graduation" element={<GraduationEvent />} />
                    <Route path="/walid-sheikha" element={<WeddingInvite />} />

                    {/* All other routes inside AuthProvider */}
                    <Route path="*" element={
                        <AuthProvider>
                            <div className="bg-blob blob-primary"></div>
                            <div className="bg-blob blob-secondary"></div>
                            <PushNotificationManager />
                            <IosInstallPrompt />
                            <PwaInstallPrompt />
                            <OnboardingManager />
                            <Routes>
                                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                                <Route path="/map" element={<ProtectedRoute><Map /></ProtectedRoute>} />
                                <Route path="/streets" element={<ProtectedRoute><StreetMap /></ProtectedRoute>} />
                                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                                <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserDetails /></AdminRoute>} />
                                <Route path="/terms" element={<LegalPages type="terms" />} />
                                <Route path="/privacy" element={<LegalPages type="privacy" />} />
                                <Route path="/support" element={<Support />} />
                                <Route path="/ar" element={<ProtectedRoute><ARView /></ProtectedRoute>} />
                                <Route path="/ar-workspace" element={<ProtectedRoute><ARWorkspace /></ProtectedRoute>} />
                                <Route path="/virtual-tour" element={<ProtectedRoute><VirtualTourMap /></ProtectedRoute>} />
                                <Route path="/" element={<Navigate to="/map" />} />
                                <Route path="*" element={<OfflinePage />} />
                            </Routes>
                        </AuthProvider>
                    } />
                </Routes>
            </React.Suspense>
        </BrowserRouter>
    );
}

export default App;
