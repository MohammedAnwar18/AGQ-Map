import React, { useState } from 'react';
import './WeddingInvite.css';

const WeddingInvite = () => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenEnvelope = () => {
        if (!isOpen) {
            setIsOpen(true);
        }
    };

    return (
        <div className="wedding-invite-page">
            {/* Ambient Bokeh Glow Background Elements */}
            <div className="bokeh-bubble bokeh-1"></div>
            <div className="bokeh-bubble bokeh-2"></div>
            <div className="bokeh-bubble bokeh-3"></div>

            {/* DEVICE MOCKUP FRAME (iPhone 15 Pro Wrapper) */}
            <div className="device-frame-container">
                {/* Dynamic Island Notch */}
                <div className="device-island"></div>

                {/* Smartphone screen viewport */}
                <div className="device-screen">

                    {/* 1. DIGITAL ENVELOPE (CLOSED LAYER) */}
                    <div 
                        className={`invite-envelope-wrapper ${isOpen ? 'open' : ''}`}
                        onClick={handleOpenEnvelope}
                    >
                        {/* Left Half Door */}
                        <div className="envelope-half-door door-left">
                            <span className="exclusive-text text-top">This invitation is</span>
                        </div>

                        {/* Right Half Door */}
                        <div className="envelope-half-door door-right">
                            <span className="exclusive-text text-bottom">exclusive for you</span>
                        </div>

                        {/* Centered Dusty Rose Wax Seal */}
                        <div className="seal-action-button">
                            <div className="dusty-rose-seal">
                                <span className="seal-monogram">W&S</span>
                            </div>
                            <span className="seal-open-instruction">انقر لفتح المغلف 🌹</span>
                        </div>
                    </div>

                    {/* 2. REVEALED WEDDING PARCHMENT CARD */}
                    <div className="revealed-wedding-card">
                        <div className="card-inner-frame">
                            {/* Floral Header Arrangement */}
                            <div className="floral-header-decor"></div>

                            <div className="event-sub-message">كتب كتابهما بمشيئة الله</div>
                            
                            {/* Calligraphic names in Diwani gradient gold style */}
                            <h1 className="names-calligraphy">وليد & شيخة</h1>
                            
                            <div className="divider-line"></div>

                            {/* Date of the wedding */}
                            <div className="event-date">
                                يوم الجمعة <br />
                                26 - 6 - 2026
                            </div>

                            {/* Faded website link */}
                            <a href="https://palnovaa.com" className="website-link" target="_blank" rel="noopener noreferrer">
                                palnovaa.com
                            </a>

                            {/* Floral Footer Arrangement */}
                            <div className="floral-footer-decor"></div>
                        </div>

                        {/* Re-seal helper (allows admin to test animation again) */}
                        {isOpen && (
                            <button 
                                className="re-seal-btn" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                                title="إعادة إغلاق الظرف للتجربة"
                            >
                                🔄 إعادة إغلاق
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default WeddingInvite;
