import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../services/adminApi';
import './AdminKokoBath.css';

const VENUE_TYPES = [
    { id: 'mall', label: 'مركز تجاري (Mall)', icon: '🛍️' },
    { id: 'hospital', label: 'مستشفى أو مركز صحي', icon: '🏥' },
    { id: 'airport', label: 'مطار دولي / محلي', icon: '✈️' },
    { id: 'hotel', label: 'فندق / منتجع', icon: '🏨' },
    { id: 'university', label: 'جامعة أو مجمع تعليمي', icon: '🎓' },
    { id: 'office', label: 'مبنى إداري / مكاتب', icon: '🏢' },
    { id: 'museum', label: 'متحف أو معرض', icon: '🏛️' },
    { id: 'stadium', label: 'استاد رياضي / صالة', icon: '🏟️' },
    { id: 'station', label: 'محطة قطار أو باصات', icon: '🚆' },
    { id: 'other', label: 'مرفق داخلي آخر', icon: '📍' }
];

export default function AdminKokoBath() {
    const [activeTab, setActiveTab] = useState('venues'); // venues, fingerprints, simulator
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [venues, setVenues] = useState([]);
    const [selectedVenue, setSelectedVenue] = useState(null);
    const [fingerprints, setFingerprints] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');

    // Modals
    const [showVenueModal, setShowVenueModal] = useState(false);
    const [editingVenue, setEditingVenue] = useState(null);
    const [venueForm, setVenueForm] = useState({
        name: '',
        type: 'mall',
        description: '',
        floorCount: 1,
        areaSqm: '',
        city: '',
        address: '',
        status: 'active',
        isPublished: true
    });

    const [showFpModal, setShowFpModal] = useState(false);
    const [fpForm, setFpForm] = useState({
        label: '',
        floor: 0,
        positionX: 0,
        positionZ: 0,
        headingDeg: 0,
        captureMethod: 'slam',
        qualityScore: 95,
        thumbnailUrl: ''
    });

    const [showQrModal, setShowQrModal] = useState(false);
    const [qrVenue, setQrVenue] = useState(null);

    // ── Simulator States ──────────────────────────────────────
    const canvasRef = useRef(null);
    const [simMode, setSimMode] = useState('nav'); // nav, mapping
    const [simTarget, setSimTarget] = useState('المصعد البانورامي');
    const [simSearchQuery, setSimSearchQuery] = useState('');
    const [isTrackingLocked, setIsTrackingLocked] = useState(true);
    const [simConfidence, setSimConfidence] = useState(98.8);
    const [simDrift, setSimDrift] = useState('±1.8 cm');
    const [cameraTilt, setCameraTilt] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // Load Initial Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, venuesRes] = await Promise.all([
                adminService.getKokoBathStats(),
                adminService.getKokoBathVenues()
            ]);
            setStats(statsRes.stats);
            const fetchedVenues = venuesRes.venues || [];
            setVenues(fetchedVenues);
            if (fetchedVenues.length > 0 && !selectedVenue) {
                setSelectedVenue(fetchedVenues[0]);
                loadFingerprints(fetchedVenues[0].id);
            }
        } catch (err) {
            console.error('KokoBath load data error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadFingerprints = async (venueId) => {
        try {
            const res = await adminService.getKokoBathFingerprints(venueId);
            setFingerprints(res.fingerprints || []);
        } catch (err) {
            console.error('Error loading fingerprints:', err);
        }
    };

    const handleSelectVenue = (venue) => {
        setSelectedVenue(venue);
        loadFingerprints(venue.id);
    };

    // ── Venue CRUD ────────────────────────────────────────────
    const openAddVenueModal = () => {
        setEditingVenue(null);
        setVenueForm({
            name: '',
            type: 'mall',
            description: '',
            floorCount: 1,
            areaSqm: '',
            city: '',
            address: '',
            status: 'active',
            isPublished: true
        });
        setShowVenueModal(true);
    };

    const openEditVenueModal = (venue) => {
        setEditingVenue(venue);
        setVenueForm({
            name: venue.name,
            type: venue.type,
            description: venue.description || '',
            floorCount: venue.floorCount,
            areaSqm: venue.areaSqm || '',
            city: venue.city || '',
            address: venue.address || '',
            status: venue.status,
            isPublished: venue.isPublished
        });
        setShowVenueModal(true);
    };

    const handleSaveVenue = async (e) => {
        e.preventDefault();
        try {
            if (editingVenue) {
                await adminService.updateKokoBathVenue(editingVenue.id, venueForm);
            } else {
                await adminService.createKokoBathVenue(venueForm);
            }
            setShowVenueModal(false);
            loadData();
        } catch (err) {
            alert('فشل في حفظ بيانات الموقع: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteVenue = async (venueId) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الموقع وكافة بصماته البصرية؟')) return;
        try {
            await adminService.deleteKokoBathVenue(venueId);
            loadData();
            if (selectedVenue?.id === venueId) {
                setSelectedVenue(null);
                setFingerprints([]);
            }
        } catch (err) {
            alert('فشل في حذف الموقع');
        }
    };

    // ── Fingerprint CRUD ──────────────────────────────────────
    const handleAddFingerprint = async (e) => {
        e.preventDefault();
        if (!selectedVenue) return;
        try {
            await adminService.addKokoBathFingerprint(selectedVenue.id, fpForm);
            setShowFpModal(false);
            loadFingerprints(selectedVenue.id);
            setFpForm({
                label: '',
                floor: 0,
                positionX: 0,
                positionZ: 0,
                headingDeg: 0,
                captureMethod: 'slam',
                qualityScore: 95,
                thumbnailUrl: ''
            });
        } catch (err) {
            alert('فشل في إضافة البصمة البصرية: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteFingerprint = async (fpId) => {
        if (!window.confirm('حذف هذه البصمة البصرية؟')) return;
        try {
            await adminService.deleteKokoBathFingerprint(fpId);
            if (selectedVenue) loadFingerprints(selectedVenue.id);
        } catch (err) {
            alert('فشل في حذف البصمة');
        }
    };

    // ── Canvas Simulator Animation ────────────────────────────
    useEffect(() => {
        if (activeTab !== 'simulator') return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;
        let frameCount = 0;

        // Generate synthetic SLAM visual feature points
        const featurePoints = Array.from({ length: 45 }, () => ({
            x: Math.random() * 800,
            y: Math.random() * 500,
            depth: 0.3 + Math.random() * 0.7,
            size: 3 + Math.random() * 3,
            color: Math.random() > 0.3 ? '#00f2fe' : '#4ade80',
            label: Math.random() > 0.85 ? 'KEY_PT_' + Math.floor(Math.random() * 900) : null
        }));

        const render = () => {
            frameCount++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const w = canvas.width;
            const h = canvas.height;
            const centerX = w / 2 + cameraTilt.x * 0.5;
            const centerY = h / 2 + cameraTilt.y * 0.5;

            // 1. Draw 3D Perspective Grid Corridor
            ctx.save();
            ctx.fillStyle = '#060b18';
            ctx.fillRect(0, 0, w, h);

            // Ceiling & Walls gradient
            const bgGrad = ctx.createRadialGradient(centerX, centerY * 0.85, 20, centerX, centerY, w * 0.7);
            bgGrad.addColorStop(0, '#0c162d');
            bgGrad.addColorStop(0.5, '#070f22');
            bgGrad.addColorStop(1, '#020612');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);

            // Perspective Grid Lines (Floor)
            ctx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
            ctx.lineWidth = 1.2;

            const vanishingY = centerY * 0.75;
            const floorStartY = vanishingY;

            // Longitudinal lines converging to vanishing point
            for (let x = -w * 0.6; x <= w * 1.6; x += 110) {
                ctx.beginPath();
                ctx.moveTo(centerX, vanishingY);
                ctx.lineTo(x + cameraTilt.x, h);
                ctx.stroke();
            }

            // Horizontal depth lines with perspective compression
            const depthSteps = 14;
            for (let i = 1; i <= depthSteps; i++) {
                const progress = Math.pow(i / depthSteps, 2.3);
                const lineY = floorStartY + progress * (h - floorStartY);
                const alpha = 0.05 + progress * 0.2;
                ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(0, lineY);
                ctx.lineTo(w, lineY);
                ctx.stroke();
            }

            // Structural Pillars / Environmental geometry
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.lineWidth = 1;

            // Left pillar
            const leftPillarX = w * 0.18 + cameraTilt.x * 0.2;
            ctx.fillRect(leftPillarX, vanishingY - 40, 50, h - (vanishingY - 40));
            ctx.strokeRect(leftPillarX, vanishingY - 40, 50, h - (vanishingY - 40));

            // Right pillar
            const rightPillarX = w * 0.74 + cameraTilt.x * 0.2;
            ctx.fillRect(rightPillarX, vanishingY - 40, 50, h - (vanishingY - 40));
            ctx.strokeRect(rightPillarX, vanishingY - 40, 50, h - (vanishingY - 40));

            // Pillar Feature Target tags
            ctx.fillStyle = '#38bdf8';
            ctx.font = '10px monospace';
            ctx.fillText('LANDMARK #4 [Z=12m]', leftPillarX + 4, vanishingY + 10);
            ctx.fillText('CORRIDOR-EAST [Z=18m]', rightPillarX - 20, vanishingY + 10);

            // 2. Draw SLAM Feature Detection Points (Feature Tracking)
            featurePoints.forEach((pt, idx) => {
                // Subtle organic tracking jitter
                const jitterX = Math.sin(frameCount * 0.04 + idx) * 1.5;
                const jitterY = Math.cos(frameCount * 0.04 + idx) * 1.5;
                const px = pt.x + cameraTilt.x * pt.depth + jitterX;
                const py = pt.y + cameraTilt.y * pt.depth + jitterY;

                // Feature Crosshair
                ctx.strokeStyle = pt.color;
                ctx.lineWidth = 1.2;
                const arm = pt.size + 2;

                ctx.beginPath();
                ctx.moveTo(px - arm, py);
                ctx.lineTo(px + arm, py);
                ctx.moveTo(px, py - arm);
                ctx.lineTo(px, py + arm);
                ctx.stroke();

                if (pt.label) {
                    ctx.fillStyle = pt.color;
                    ctx.font = '9px monospace';
                    ctx.fillText(pt.label, px + 6, py - 4);
                }
            });

            // 3. Draw AR 3D Navigation Arrows on the Ground (Chevrons)
            if (simMode === 'nav') {
                const arrowCount = 5;
                const pulseOffset = (frameCount * 0.03) % 1;

                for (let i = 0; i < arrowCount; i++) {
                    const t = ((i / arrowCount) + pulseOffset) % 1;
                    const scale = 0.3 + t * 1.2;
                    const arrowY = floorStartY + Math.pow(t, 1.8) * (h - floorStartY - 40);
                    const arrowX = centerX + Math.sin(t * 2.5) * 45;

                    ctx.save();
                    ctx.translate(arrowX, arrowY);
                    ctx.scale(scale, scale * 0.5); // Perspective flattening

                    // Glow effect
                    ctx.shadowColor = '#00f2fe';
                    ctx.shadowBlur = 15;

                    // Neon Chevron
                    ctx.beginPath();
                    ctx.moveTo(-40, 20);
                    ctx.lineTo(0, -20);
                    ctx.lineTo(40, 20);
                    ctx.lineTo(30, 32);
                    ctx.lineTo(0, 0);
                    ctx.lineTo(-30, 32);
                    ctx.closePath();

                    const arrowGrad = ctx.createLinearGradient(0, -20, 0, 30);
                    arrowGrad.addColorStop(0, '#00f2fe');
                    arrowGrad.addColorStop(1, '#3b82f6');
                    ctx.fillStyle = arrowGrad;
                    ctx.fill();

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                }

                // AR Pin at the destination (at the vanishing point area)
                const pinX = centerX + 15;
                const pinY = vanishingY + 30;

                ctx.save();
                ctx.shadowColor = '#f59e0b';
                ctx.shadowBlur = 20;

                // Floating destination banner
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 1.5;

                const bannerW = 160;
                const bannerH = 34;
                ctx.beginPath();
                ctx.roundRect(pinX - bannerW / 2, pinY - 50, bannerW, bannerH, 8);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 12px Tajawal, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`🎯 ${simTarget} (18m)`, pinX, pinY - 28);

                // Pointer line down to floor
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pinX, pinY - 16);
                ctx.lineTo(pinX, pinY);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(pinX, pinY, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fbbf24';
                ctx.fill();

                ctx.restore();
            }

            ctx.restore();
            animId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animId);
        };
    }, [activeTab, simMode, simTarget, cameraTilt]);

    // Handle interactive pan on canvas
    const handleMouseDown = (e) => {
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        dragStart.current = { x: e.clientX, y: e.clientY };

        setCameraTilt(prev => ({
            x: Math.max(-120, Math.min(120, prev.x + dx * 0.8)),
            y: Math.max(-80, Math.min(80, prev.y + dy * 0.8))
        }));
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    // Filtered Venues
    const filteredVenues = venues.filter(v => {
        const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (v.city && v.city.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = filterType === 'all' || v.type === filterType;
        return matchesSearch && matchesType;
    });

    const handleQuickDestSelect = (name) => {
        setSimTarget(name);
        setSimConfidence(99.2);
        setSimDrift('±1.2 cm');
    };

    const handleAiSearch = (e) => {
        e.preventDefault();
        if (!simSearchQuery.trim()) return;
        const q = simSearchQuery.trim();
        let target = q;
        if (q.includes('أكل') || q.includes('مطعم') || q.includes('كافيه')) {
            target = 'مجمع المطاعم والمقاهي (Food Court)';
        } else if (q.includes('مصعد') || q.includes('درج')) {
            target = 'المصعد البانورامي المركزي';
        } else if (q.includes('حمام') || q.includes('دورة')) {
            target = 'دورات المياه - الجناح الشرقي';
        } else if (q.includes('خروج') || q.includes('بوابة')) {
            target = 'بوابة الخروج الرئيسية #2';
        }
        setSimTarget(target);
        setSimSearchQuery('');
    };

    return (
        <div className="kokobath-container" dir="rtl">
            {/* ── Top Hero Banner ─────────────────────────────────── */}
            <div className="kokobath-hero">
                <div className="kokobath-hero-info">
                    <div className="kokobath-badge-pill">
                        <span className="pulse-dot"></span>
                        نظام تحديد المواقع البصري (VPS) والواقع المعزز (AR)
                    </div>
                    <h2 className="kokobath-hero-title">
                        🧭 كوكوباث — KokoBath Navigation
                    </h2>
                    <p className="kokobath-hero-desc">
                        الملاحة الداخلية الدقيقة بدون GPS وبدون رسومات هندسية تقليدية. الكاميرا تحل محل الأقمار الصناعية
                        من خلال استخراج البصمة البصرية للمكان عبر SLAM وحساسات الحركة، ورسم مسارات الواقع المعزز على الأرض الحقيقية بدقة السنتيمتر.
                    </p>
                </div>
                <div className="kokobath-hero-actions">
                    <button className="kb-btn kb-btn-primary" onClick={openAddVenueModal}>
                        ➕ إضافة موقع جديد
                    </button>
                    <button className="kb-btn kb-btn-secondary" onClick={() => setActiveTab('simulator')}>
                        🎮 فتح محاكي الكاميرا VPS
                    </button>
                </div>
            </div>

            {/* ── Stats Grid ────────────────────────────────────────── */}
            {stats && (
                <div className="kokobath-stats-grid">
                    <div className="kb-stat-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #00f2fe, #4facfe)' }}>
                        <div className="kb-stat-icon" style={{ '--icon-bg': 'rgba(0, 242, 254, 0.12)', '--icon-border': 'rgba(0, 242, 254, 0.3)' }}>
                            🏢
                        </div>
                        <div className="kb-stat-body">
                            <span className="kb-stat-val">{stats.totalVenues}</span>
                            <span className="kb-stat-lbl">إجمالي المواقع والمباني</span>
                        </div>
                    </div>

                    <div className="kb-stat-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #10b981, #34d399)' }}>
                        <div className="kb-stat-icon" style={{ '--icon-bg': 'rgba(16, 185, 129, 0.12)', '--icon-border': 'rgba(16, 185, 129, 0.3)' }}>
                            👁️
                        </div>
                        <div className="kb-stat-body">
                            <span className="kb-stat-val">{stats.totalFingerprints}</span>
                            <span className="kb-stat-lbl">بصمات بصرية مسجلة</span>
                        </div>
                    </div>

                    <div className="kb-stat-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #7928ca, #ff0080)' }}>
                        <div className="kb-stat-icon" style={{ '--icon-bg': 'rgba(121, 40, 202, 0.12)', '--icon-border': 'rgba(121, 40, 202, 0.3)' }}>
                            📡
                        </div>
                        <div className="kb-stat-body">
                            <span className="kb-stat-val">{stats.activeVenues}</span>
                            <span className="kb-stat-lbl">مواقع مفعّلة وجاهزة</span>
                        </div>
                    </div>

                    <div className="kb-stat-card" style={{ '--accent-gradient': 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}>
                        <div className="kb-stat-icon" style={{ '--icon-bg': 'rgba(245, 158, 11, 0.12)', '--icon-border': 'rgba(245, 158, 11, 0.3)' }}>
                            🎯
                        </div>
                        <div className="kb-stat-body">
                            <span className="kb-stat-val">± 2.0 cm</span>
                            <span className="kb-stat-lbl">دقة التموضع البصري (VPS)</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Navigation Tabs ─────────────────────────────── */}
            <div className="kokobath-nav-tabs">
                <button
                    className={`kb-tab-btn ${activeTab === 'venues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('venues')}
                >
                    🏢 إدارة المواقع والمباني ({venues.length})
                </button>
                <button
                    className={`kb-tab-btn ${activeTab === 'fingerprints' ? 'active' : ''}`}
                    onClick={() => setActiveTab('fingerprints')}
                >
                    👁️ البصمات البصرية (Visual SLAM)
                </button>
                <button
                    className={`kb-tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
                    onClick={() => setActiveTab('simulator')}
                >
                    🎯 محاكي الملاحة والواقع المعزز (AR Simulator)
                </button>
            </div>

            {/* ── Tab 1: Venues Management ─────────────────────────── */}
            {activeTab === 'venues' && (
                <div className="kb-card">
                    <div className="kb-card-header">
                        <div className="kb-card-title-group">
                            <h3>🏢 المواقع المسجلة على شبكة كوكوباث</h3>
                            <p>المولات، المستشفيات، المطارات، ومجمعات المباني المزودة بتقنية الملاحة المكانية</p>
                        </div>
                        <div className="kb-card-actions">
                            <input
                                type="text"
                                className="kb-search-input"
                                placeholder="🔍 بحث عن مبنى أو مدينة..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <select
                                className="kb-select"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="all">كل الأنواع</option>
                                {VENUE_TYPES.map(t => (
                                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                                ))}
                            </select>
                            <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={openAddVenueModal}>
                                ➕ مبنى جديد
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            جاري تحميل بيانات كوكوباث...
                        </div>
                    ) : filteredVenues.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            لا توجد مواقع مسجلة مطابقة للبحث. قم بإضافة أول مبنى للبدء!
                        </div>
                    ) : (
                        <div className="kb-venues-grid">
                            {filteredVenues.map(venue => (
                                <div key={venue.id} className="kb-venue-card">
                                    <div>
                                        <div className="kb-venue-header">
                                            <span className="kb-venue-type-tag">
                                                {VENUE_TYPES.find(t => t.id === venue.type)?.icon || '📍'} {venue.typeLabel}
                                            </span>
                                            <span className={`kb-status-badge ${venue.status === 'active' ? 'kb-status-active' : 'kb-status-pending'}`}>
                                                {venue.status === 'active' ? '● مفعّل' : 'قيد المعالجة'}
                                            </span>
                                        </div>
                                        <h4 className="kb-venue-title">{venue.name}</h4>
                                        <div className="kb-venue-location">
                                            📍 {venue.city || 'القدس / فلسطين'} {venue.address ? `• ${venue.address}` : ''}
                                        </div>
                                    </div>

                                    <div className="kb-venue-meta">
                                        <div className="kb-venue-meta-item">
                                            <span className="val">{venue.floorCount}</span>
                                            <span className="lbl">طوابق</span>
                                        </div>
                                        <div className="kb-venue-meta-item">
                                            <span className="val">{venue.fingerprintCount}</span>
                                            <span className="lbl">بصمات بصرية</span>
                                        </div>
                                        <div className="kb-venue-meta-item">
                                            <span className="val">{venue.areaSqm ? `${venue.areaSqm}m²` : '—'}</span>
                                            <span className="lbl">المساحة</span>
                                        </div>
                                    </div>

                                    <div className="kb-venue-actions">
                                        <button
                                            className="kb-btn kb-btn-secondary kb-btn-sm"
                                            onClick={() => {
                                                handleSelectVenue(venue);
                                                setActiveTab('fingerprints');
                                            }}
                                            title="عرض البصمات المكانية"
                                        >
                                            👁️ البصمات
                                        </button>
                                        <button
                                            className="kb-btn kb-btn-secondary kb-btn-sm"
                                            onClick={() => {
                                                handleSelectVenue(venue);
                                                setActiveTab('simulator');
                                            }}
                                            title="اختبار الملاحة بالواقع المعزز"
                                        >
                                            🎮 تجربة المحاكي
                                        </button>
                                        <button
                                            className="kb-btn kb-btn-secondary kb-btn-sm"
                                            onClick={() => {
                                                setQrVenue(venue);
                                                setShowQrModal(true);
                                            }}
                                            title="مشاركة رمز QR للزوار"
                                        >
                                            📱 رمز QR
                                        </button>
                                        <button
                                            className="kb-btn kb-btn-secondary kb-btn-sm"
                                            onClick={() => openEditVenueModal(venue)}
                                            title="تعديل بيانات الموقع"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="kb-btn kb-btn-secondary kb-btn-sm"
                                            style={{ color: '#ef4444' }}
                                            onClick={() => handleDeleteVenue(venue.id)}
                                            title="حذف الموقع"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab 2: Visual Fingerprints (SLAM) ────────────────── */}
            {activeTab === 'fingerprints' && (
                <div className="kb-card">
                    <div className="kb-card-header">
                        <div className="kb-card-title-group">
                            <h3>👁️ شبكة البصمات البصرية ونقاط التعرف المكاني (Visual Descriptors)</h3>
                            <p>
                                النقاط المميزة (Features) التي تلتقطها الكاميرا بتقنية SLAM: زوايا الأعمدة، حواف اللافتات، ونقوش الأرضيات
                            </p>
                        </div>
                        <div className="kb-card-actions">
                            <select
                                className="kb-select"
                                value={selectedVenue?.id || ''}
                                onChange={(e) => {
                                    const v = venues.find(x => x.id === Number(e.target.value));
                                    if (v) handleSelectVenue(v);
                                }}
                            >
                                {venues.map(v => (
                                    <option key={v.id} value={v.id}>🏢 {v.name}</option>
                                ))}
                            </select>
                            <button
                                className="kb-btn kb-btn-primary kb-btn-sm"
                                onClick={() => setShowFpModal(true)}
                                disabled={!selectedVenue}
                            >
                                ➕ تسجيل بصمة جديدة
                            </button>
                        </div>
                    </div>

                    {!selectedVenue ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            يرجى اختيار موقع أولاً لعرض بصماته البصرية.
                        </div>
                    ) : fingerprints.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            لم يتم التقاط بصمات بصرية لهذا الموقع بعد. يمكنك البدء بمسح المكان من خلال التطبيق أو إضافة نقطة مرجعية يدوياً.
                        </div>
                    ) : (
                        <div className="kb-fp-grid">
                            {fingerprints.map(fp => (
                                <div key={fp.id} className="kb-fp-card">
                                    <div className="kb-fp-thumbnail">
                                        {fp.thumbnailUrl ? (
                                            <img src={fp.thumbnailUrl} alt={fp.label} />
                                        ) : (
                                            <div className="kb-fp-radar-mock">
                                                <div className="reticle"></div>
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="kb-fp-title">{fp.label}</h4>
                                    <div className="kb-fp-details">
                                        <span>الطابق: {fp.floor}</span>
                                        <span>(X: {fp.positionX}m, Z: {fp.positionZ}m)</span>
                                    </div>
                                    <div className="kb-fp-details">
                                        <span>جودة البصمة: <strong style={{ color: '#4ade80' }}>{fp.qualityScore || 95}%</strong></span>
                                        <span>الزاوية: {fp.headingDeg}°</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                        <button
                                            className="kb-btn kb-btn-secondary kb-btn-sm"
                                            style={{ color: '#ef4444' }}
                                            onClick={() => handleDeleteFingerprint(fp.id)}
                                        >
                                            🗑️ حذف
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab 3: Interactive AR & VPS Simulator ────────────── */}
            {activeTab === 'simulator' && (
                <div className="kb-sim-wrapper">
                    {/* Viewport Screen */}
                    <div className="kb-sim-screen">
                        <canvas
                            ref={canvasRef}
                            className="kb-sim-canvas"
                            width={820}
                            height={520}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />

                        {/* Top HUD */}
                        <div className="kb-hud-top">
                            <div className="kb-hud-tag">
                                <span className="pulse-dot"></span>
                                {simMode === 'nav' ? 'AR NAVIGATION MODE (User)' : 'SLAM MAPPING MODE (Admin)'}
                            </div>
                            <div className="kb-hud-stats">
                                <div>حالة التموضع: <span className="val">مقفول (LOCKED)</span></div>
                                <div>الدقة: <span className="val">{simDrift}</span></div>
                                <div>المطابقة البصرية: <span className="val">{simConfidence}%</span></div>
                            </div>
                        </div>

                        {/* Center Scanning Crosshair */}
                        <div className="kb-hud-crosshair"></div>

                        {/* Bottom HUD Guidance Banner */}
                        <div className="kb-hud-bottom">
                            <div className="kb-hud-guidance">
                                <div className="arrow-icon">⬆️</div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>إرشاد الواقع المعزز الذكي</div>
                                    <div>اتبع الأسهم على الأرض نحو: <strong>{simTarget}</strong> (18 متراً)</div>
                                </div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                                💡 اسحب بالماوس لتدوير زاوية الكاميرا
                            </div>
                        </div>
                    </div>

                    {/* Simulator Controls & AI Search */}
                    <div className="kb-sim-controls">
                        <h4>🧠 مساعد الملاحة والذكاء الاصطناعي</h4>

                        <form onSubmit={handleAiSearch}>
                            <div className="kb-voice-search-box">
                                <input
                                    type="text"
                                    placeholder="اسأل باللغة الطبيعية: وين آكل؟ المصعد؟"
                                    value={simSearchQuery}
                                    onChange={(e) => setSimSearchQuery(e.target.value)}
                                />
                                <span className="ai-icon">✨</span>
                            </div>
                        </form>

                        <div>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                                وجهات سريعة في الموقع:
                            </span>
                            <div className="kb-quick-destinations">
                                {[
                                    'المصعد البانورامي',
                                    'مجمع المطاعم',
                                    'بوابة الخروج الرئيسية',
                                    'صيدلية المركز',
                                    'محل زارا (طابق 1)',
                                    'دورات المياه'
                                ].map(dest => (
                                    <button
                                        key={dest}
                                        className={`kb-dest-chip ${simTarget === dest ? 'active' : ''}`}
                                        onClick={() => handleQuickDestSelect(dest)}
                                    >
                                        {dest}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                                نمط المحاكاة:
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className={`kb-btn kb-btn-sm ${simMode === 'nav' ? 'kb-btn-primary' : 'kb-btn-secondary'}`}
                                    onClick={() => setSimMode('nav')}
                                    style={{ flex: 1 }}
                                >
                                    🚶 ملاحة مستخدم
                                </button>
                                <button
                                    className={`kb-btn kb-btn-sm ${simMode === 'mapping' ? 'kb-btn-purple' : 'kb-btn-secondary'}`}
                                    onClick={() => setSimMode('mapping')}
                                    style={{ flex: 1 }}
                                >
                                    📹 مسح SLAM
                                </button>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: '12px', borderRadius: '12px', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                            <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>
                                📌 كيف تعمل تقنية كوكوباث؟
                            </div>
                            تدمج خوارزميات SLAM البصرية بين معالم الصورة وحساسات التسارع والجيروسكوب لتحديد الإحداثيات الثلاثية بدقة سنتيمترية دون الاعتماد على GPS إطلاقاً.
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Add / Edit Venue ──────────────────────────── */}
            {showVenueModal && (
                <div className="kb-modal-overlay" onClick={() => setShowVenueModal(false)}>
                    <div className="kb-modal" onClick={e => e.stopPropagation()}>
                        <div className="kb-modal-header">
                            <h3>{editingVenue ? '✏️ تعديل بيانات الموقع' : '➕ إضافة موقع أو مبنى جديد'}</h3>
                            <button className="kb-modal-close" onClick={() => setShowVenueModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSaveVenue} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="kb-form-group">
                                <label>اسم الموقع أو المجمع *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: مول فلسطين سنتر، مستشفى الشفاء..."
                                    value={venueForm.name}
                                    onChange={e => setVenueForm({ ...venueForm, name: e.target.value })}
                                />
                            </div>

                            <div className="kb-form-row">
                                <div className="kb-form-group">
                                    <label>نوع المرفق</label>
                                    <select
                                        value={venueForm.type}
                                        onChange={e => setVenueForm({ ...venueForm, type: e.target.value })}
                                    >
                                        {VENUE_TYPES.map(t => (
                                            <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="kb-form-group">
                                    <label>عدد الطوابق</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={venueForm.floorCount}
                                        onChange={e => setVenueForm({ ...venueForm, floorCount: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="kb-form-row">
                                <div className="kb-form-group">
                                    <label>المدينة</label>
                                    <input
                                        type="text"
                                        placeholder="مثال: رام الله، غزة، نابلس..."
                                        value={venueForm.city}
                                        onChange={e => setVenueForm({ ...venueForm, city: e.target.value })}
                                    />
                                </div>
                                <div className="kb-form-group">
                                    <label>المساحة الإجمالية (م² تقريبية)</label>
                                    <input
                                        type="number"
                                        placeholder="مثال: 12000"
                                        value={venueForm.areaSqm}
                                        onChange={e => setVenueForm({ ...venueForm, areaSqm: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="kb-form-group">
                                <label>العنوان التفصيلي</label>
                                <input
                                    type="text"
                                    placeholder="الشارع، المنطقة، معالم قريبة"
                                    value={venueForm.address}
                                    onChange={e => setVenueForm({ ...venueForm, address: e.target.value })}
                                />
                            </div>

                            <div className="kb-form-group">
                                <label>وصف توضيحي للمكان</label>
                                <textarea
                                    rows="2"
                                    placeholder="ملاحظات حول المداخل، أوقات العمل..."
                                    value={venueForm.description}
                                    onChange={e => setVenueForm({ ...venueForm, description: e.target.value })}
                                />
                            </div>

                            <div className="kb-modal-footer">
                                <button type="button" className="kb-btn kb-btn-secondary" onClick={() => setShowVenueModal(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="kb-btn kb-btn-primary">
                                    {editingVenue ? '💾 حفظ التعديلات' : '✅ إنشاء الموقع'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal: Add Visual Fingerprint ────────────────────── */}
            {showFpModal && (
                <div className="kb-modal-overlay" onClick={() => setShowFpModal(false)}>
                    <div className="kb-modal" onClick={e => e.stopPropagation()}>
                        <div className="kb-modal-header">
                            <h3>👁️ إضافة نقطة بصمة بصرية (Visual Keypoint)</h3>
                            <button className="kb-modal-close" onClick={() => setShowFpModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddFingerprint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="kb-form-group">
                                <label>تسمية النقطة أو المعلم البصري *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: زاوية العمود C4 - مقابل مصاعد الطابق الأرضي"
                                    value={fpForm.label}
                                    onChange={e => setFpForm({ ...fpForm, label: e.target.value })}
                                />
                            </div>

                            <div className="kb-form-row">
                                <div className="kb-form-group">
                                    <label>رقم الطابق</label>
                                    <input
                                        type="number"
                                        value={fpForm.floor}
                                        onChange={e => setFpForm({ ...fpForm, floor: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="kb-form-group">
                                    <label>طريقة الالتقاط</label>
                                    <select
                                        value={fpForm.captureMethod}
                                        onChange={e => setFpForm({ ...fpForm, captureMethod: e.target.value })}
                                    >
                                        <option value="slam">SLAM (كاميرا الهاتف أثناء المشي)</option>
                                        <option value="manual">إدخال يدوي</option>
                                        <option value="lidar">مستشعر LiDAR</option>
                                        <option value="photo">صورة مرجعية عالية الدقة</option>
                                    </select>
                                </div>
                            </div>

                            <div className="kb-form-row">
                                <div className="kb-form-group">
                                    <label>الإحداثي X (بالأمتار)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={fpForm.positionX}
                                        onChange={e => setFpForm({ ...fpForm, positionX: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="kb-form-group">
                                    <label>الإحداثي Z (بالأمتار)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={fpForm.positionZ}
                                        onChange={e => setFpForm({ ...fpForm, positionZ: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="kb-form-row">
                                <div className="kb-form-group">
                                    <label>زاوية التوجيه (Heading °)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="360"
                                        value={fpForm.headingDeg}
                                        onChange={e => setFpForm({ ...fpForm, headingDeg: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="kb-form-group">
                                    <label>مستوى جودة البصمة (%)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={fpForm.qualityScore}
                                        onChange={e => setFpForm({ ...fpForm, qualityScore: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="kb-modal-footer">
                                <button type="button" className="kb-btn kb-btn-secondary" onClick={() => setShowFpModal(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="kb-btn kb-btn-primary">
                                    💾 حفظ البصمة في السيرفر
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal: QR Code Sharing ───────────────────────────── */}
            {showQrModal && qrVenue && (
                <div className="kb-modal-overlay" onClick={() => setShowQrModal(false)}>
                    <div className="kb-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
                        <div className="kb-modal-header">
                            <h3>📱 رمز QR لملاحة كوكوباث</h3>
                            <button className="kb-modal-close" onClick={() => setShowQrModal(false)}>✕</button>
                        </div>
                        <div className="kb-qr-display">
                            <div className="kb-qr-box">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.origin + '/vps/' + (qrVenue.qrSlug || qrVenue.id))}`}
                                    alt="QR Code"
                                    style={{ width: '200px', height: '200px', display: 'block' }}
                                />
                            </div>
                            <h4 style={{ margin: '8px 0 2px 0', color: '#f8fafc' }}>{qrVenue.name}</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                                قم بمسح الرمز بكاميرا الهاتف لبدء الملاحة الفورية داخل المبنى
                            </p>
                            <div className="kb-qr-url-text">
                                {window.location.origin}/vps/{qrVenue.qrSlug || qrVenue.id}
                            </div>
                        </div>
                        <div className="kb-modal-footer" style={{ justifyContent: 'center' }}>
                            <button
                                className="kb-btn kb-btn-primary kb-btn-sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/vps/${qrVenue.qrSlug || qrVenue.id}`);
                                    alert('تم نسخ رابط الملاحة إلى الحافظة! ✅');
                                }}
                            >
                                📋 نسخ الرابط
                            </button>
                            <button className="kb-btn kb-btn-secondary kb-btn-sm" onClick={() => setShowQrModal(false)}>
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
