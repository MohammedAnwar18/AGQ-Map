import React, { useState } from 'react';
import { Warp } from "@paper-design/shaders-react";
import './PalNovaaRepository.css';

const PalNovaaRepository = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    return (
        <div 
            className="repository-overlay-container"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Close Button */}
            <button className="repository-close-btn" onClick={onClose} title="إغلاق">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            {/* Background shader - kept exactly as base properties */}
            <div className="repository-shader-bg">
                <Warp
                    style={{ height: "100%", width: "100%" }}
                    proportion={0.45}
                    softness={1}
                    distortion={0.25}
                    swirl={0.8}
                    swirlIterations={10}
                    shape="checks"
                    shapeScale={0.1}
                    scale={1}
                    rotation={0}
                    speed={1}
                    colors={["hsl(217, 54%, 11%)", "hsl(38, 90%, 55%)", "hsl(213, 44%, 18%)", "hsl(194, 96%, 49%)"]}
                />
            </div>
            
            {/* Mouse Follower Glow Light */}
            <div 
                className="repository-mouse-follower"
                style={{
                    transform: `translate3d(${mousePos.x - 250}px, ${mousePos.y - 250}px, 0)`,
                    opacity: isHovering ? 1 : 0
                }}
            />
            
            {/* Glowing organic blobs that flash and pulse on focus with theme colors */}
            <div className={`repository-glow-dot dot-1 ${isFocused ? 'active' : ''}`}></div>
            <div className={`repository-glow-dot dot-2 ${isFocused ? 'active' : ''}`}></div>
            <div className={`repository-glow-dot dot-3 ${isFocused ? 'active' : ''}`}></div>
            
            {/* Vignette Overlay */}
            <div className="repository-shader-overlay"></div>

            {/* Centered Glass Card */}
            <div className="repository-content-card">
                <span className="repository-tag">ميزة جديدة قادمة</span>
                
                <h1 className="repository-title">مستودع بالنوفا</h1>
                <div className="repository-subtitle">PalNovaa Repository</div>
                
                <p className="repository-description">
                    نعمل حالياً على تطوير مستودع بالنوفا الرقمي المخصص لمشاركة وتحميل الطبقات الجغرافية.
                </p>

                <div className="repository-search-container">
                    <div className="repository-input-wrapper">
                        <input
                            type="text"
                            placeholder="بحث عن البيانات..."
                            className={`repository-search-input ${isFocused ? 'focused' : ''}`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                        />
                        <button className="repository-search-btn" title="بحث">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PalNovaaRepository;
