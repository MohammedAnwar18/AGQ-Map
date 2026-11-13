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
const ARModelView = React.lazy(() => import('./pages/ARModelView'));
const IndoorNav   = React.lazy(() => import('./pages/IndoorNav'));
const ARView = React.lazy(() => import('./pages/ARView'));
const ARWorkspace = React.lazy(() => import('./pages/ARWorkspace'));
const VirtualTourMap = React.lazy(() => import('./pages/VirtualTourMap'));
const DigitalLetterView = React.lazy(() => import('./pages/DigitalLetterView'));
const GraduationEvent = React.lazy(() => import('./pages/GraduationEvent'));
const GeoportalDesigner = React.lazy(() => import('./pages/GeoportalDesigner'));
const GeoportalViewer = React.lazy(() => import('./pages/GeoportalViewer'));
const PalNovaaLabPage = React.lazy(() => import('./pages/PalNovaaLabPage'));
const PalNovaaForesightPage = React.lazy(() => import('./pages/PalNovaaForesightPage'));
const PalNovaaEnginePage = React.lazy(() => import('./pages/PalNovaaEnginePage'));
const PalNovaaEngineView = React.lazy(() => import('./pages/PalNovaaEngineView'));
import WeddingInvite from './pages/WeddingInvite';

import OfflinePage from './components/OfflinePage';
import PushNotificationManager from './components/PushNotificationManager';
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

// الخريطة مفتوحة للجميع: نحن ننتظر انتهاء التحقق من الجلسة فقط،
// حتى يعرف التطبيق إن كان الزائر مسجّلاً أم لا، ثم نعرضها في الحالتين.
const PublicMapRoute = ({ children }) => {
    const { loading } = useAuth();

    if (loading) return <SplashLoading />;

    return children;
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

        const isCustomInvitePath = window.location.pathname === '/walid-sheikha';
        const isGeoportalPath = window.location.pathname.startsWith('/geoportal');
        const delay = (isCustomInvitePath || isGeoportalPath) ? 0 : 3000;

        // Splash Screen Logic (3 Seconds)
        const timer = setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                if (isCustomInvitePath || isGeoportalPath) {
                    splash.style.display = 'none';
                    document.body.classList.remove('splash-active');
                } else {
                    splash.classList.add('fade-out');
                    document.body.classList.remove('splash-active');
                    setTimeout(() => {
                        splash.style.display = 'none';
                    }, 600);
                }
            }
        }, delay);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearTimeout(timer);
        };
    }, []);

    const isGeoportalPath = window.location.pathname.startsWith('/geoportal');
    const suspenseFallback = isGeoportalPath ? (
        <div style={{ position: 'fixed', inset: 0, background: '#ffffff', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }}></div>
        </div>
    ) : <SplashLoading />;

        const isBirzeitDomain = window.location.hostname.includes('birzeit') || window.location.hostname.includes('municipality.ps');

        return (
            <BrowserRouter>
                <React.Suspense fallback={suspenseFallback}>
                    <Routes>
                        {/* 🌐 Custom Municipality Domain Direct Root Route */}
                        {isBirzeitDomain && <Route path="/" element={<GeoportalViewer />} />}

                        {/* 🌐 Public Geoportal Viewer routes */}
                        <Route path="/geoportal/:slug" element={<GeoportalViewer />} />
                        <Route path="/geoportal" element={<GeoportalViewer />} />
                        <Route path="/p/:slug" element={<PublishedView />} />
                        {/* عارض مشاريع محرّك بالنوفا — رابطٌ دائم عامّ، بلا حساب */}
                        <Route path="/pe/:slug" element={<PalNovaaEngineView />} />
                        {/* 🧊 صفحة المجسّم التي يفتحها رمز QR — مستقلّة وبلا حساب */}
                        <Route path="/m/:slug" element={<ARModelView />} />
                        {/* دليل داخلي بالكاميرا — يُفتح بالرابط أو بمسح الرمز، بلا حساب */}
                        <Route path="/nav/:slug" element={<IndoorNav />} />
                        <Route path="/l/:slug" element={<DigitalLetterView />} />
                        <Route path="/enas-graduation" element={<GraduationEvent />} />
                        <Route path="/walid-sheikha" element={<WeddingInvite />} />

                    {/* All other routes inside AuthProvider */}
                    <Route path="*" element={
                        <AuthProvider>
                            <div className="bg-blob blob-primary"></div>
                            <div className="bg-blob blob-secondary"></div>
                            <PushNotificationManager />
                            <OnboardingManager />
                            <Routes>
                                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                                <Route path="/map" element={<PublicMapRoute><Map /></PublicMapRoute>} />
                                {/* رابط مشاركة المحل: يفتح الخريطة على صفحة المحل مباشرة */}
                                <Route path="/shop/:shopId" element={<PublicMapRoute><Map /></PublicMapRoute>} />
                                <Route path="/streets" element={<ProtectedRoute><StreetMap /></ProtectedRoute>} />
                                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                                <Route path="/admin/geoportal" element={<AdminRoute><GeoportalDesigner /></AdminRoute>} />
                                <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserDetails /></AdminRoute>} />
                                <Route path="/terms" element={<LegalPages type="terms" />} />
                                <Route path="/privacy" element={<LegalPages type="privacy" />} />
                                <Route path="/support" element={<Support />} />
                                {/* مختبر بالنوفا — رابطٌ مستقلٌّ مباشرٌ قابلٌ للأرشفة، بلا مرورٍ بالخريطة */}
                                <Route path="/palnovaa-lab" element={<PalNovaaLabPage />} />
                                <Route path="/lab" element={<Navigate to="/palnovaa-lab" replace />} />
                                {/* PalNovaa Foresight — سبلاش البداية ثم الاستوديو، على رابطٍ نظيفٍ واحد
                                    (سبلاش الموقع العامّة مكتومة لهذا المسار عبر pn-foresight في index.html) */}
                                <Route path="/palnovaa-foresight" element={<PalNovaaForesightPage />} />
                                <Route path="/foresight" element={<Navigate to="/palnovaa-foresight" replace />} />
                                {/* محرّك بالنوفا — يبني تطبيقات GIS من وصفٍ نصّيّ بموديل PalNovaa 1.0 */}
                                <Route path="/palnovaa-engine" element={<PalNovaaEnginePage />} />
                                <Route path="/engine" element={<Navigate to="/palnovaa-engine" replace />} />
                                <Route path="/ar" element={<ProtectedRoute><ARView /></ProtectedRoute>} />
                                <Route path="/ar-workspace" element={<ProtectedRoute><ARWorkspace /></ProtectedRoute>} />
                                <Route path="/virtual-tour" element={<ProtectedRoute><VirtualTourMap /></ProtectedRoute>} />
                                <Route path="/" element={<Navigate to="/map" replace />} />
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
