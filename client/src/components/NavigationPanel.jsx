import React, { useEffect, useState } from 'react';
import './NavigationPanel.css';

const NavigationPanel = ({ destination, routeStats, onStopNavigation, isTracking, onToggleTracking }) => {
    // We can add local state for visuals or calculated updates if needed, 
    // but the parent Map component should handle the heavy logic of `routeStats`.
    // However, if we want "interactive" visual updates (like a countdown purely client side), we can do it here.
    // For now, we rely on props.

    if (!destination || !routeStats) return null;

    // Format destination name safely
    const destName = destination.display_name?.split(',')[0] || destination.name || "وجهة محددة";

    // Parse stats
    // Assuming routeStats = { distance: "5.2 كم", duration: "12 دقيقة" }
    // We might want to strip non-numeric for styling if needed, but strings are fine.

    return (
        <div className="navigation-panel">
            <div className="nav-header">
                <h3 className="nav-title">
                    <span className="status-indicator"></span>
                    معلومات الرحلة
                </h3>
                <button className="nav-close-btn" onClick={onStopNavigation} title="إلغاء">✕</button>
            </div>

            <div className="nav-content">
                <div className="nav-destination">
                    <span className="dest-label">الوجهة:</span>
                    <span className="dest-name">{destName}</span>
                </div>

                <div className="nav-stats">
                    <div className="stat-box">
                        <span className="stat-value">{routeStats.duration}</span>
                        <span className="stat-label">الوقت المتبقي</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-value">{routeStats.distance}</span>
                        <span className="stat-label">المسافة</span>
                    </div>
                </div>

                <div className="nav-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                        className={`btn-track ${isTracking ? 'active' : ''}`}
                        onClick={onToggleTracking}
                        style={{
                            background: isTracking ? '#22c55e' : '#f3f4f6',
                            color: isTracking ? 'white' : '#374151',
                            border: 'none',
                            padding: '12px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontFamily: "'Tajawal', sans-serif",
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s ease',
                            height: '80px'
                        }}
                    >
                        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{isTracking ? '📍' : '◎'}</span>
                        <span>{isTracking ? 'تتبع مفعل' : 'متابعة موقعي'}</span>
                    </button>
                    <button
                        className="btn-stop-nav"
                        onClick={onStopNavigation}
                        style={{
                            borderRadius: '12px',
                            fontFamily: "'Tajawal', sans-serif",
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            height: '80px',
                            padding: '12px'
                        }}
                    >
                        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🚫</span>
                        <span>إنهاء الرحلة</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NavigationPanel;
