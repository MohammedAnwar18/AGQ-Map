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
        <div className="navigation-panel-compact">
            <div className="nav-compact-main">
                <div className="nav-time-pill">
                    <span className="time-val">{routeStats.duration}</span>
                </div>
                
                <div className="nav-info-group">
                    <div className="nav-dest-mini">
                        {destName}
                    </div>
                    <div className="nav-dist-mini">
                        {routeStats.distance}
                    </div>
                </div>

                <div className="nav-actions-mini">
                    <button 
                        className={`mini-action-btn ${isTracking ? 'active' : ''}`} 
                        onClick={onToggleTracking}
                        title={isTracking ? 'إلغاء التتبع' : 'تتبع الموقع'}
                    >
                        {isTracking ? '📍' : '🎯'}
                    </button>
                    <button 
                        className="mini-action-btn stop" 
                        onClick={onStopNavigation}
                        title="إنهاء"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NavigationPanel;
