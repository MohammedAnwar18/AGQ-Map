import React from 'react';

const MagazineBackground = () => {
    return (
        <div className="magazine-svg-bg">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    {/* 
                        Contour Pattern: Focused on uniform distribution across the screen.
                        Using white lines with subtle opacity for a premium look.
                    */}
                    <pattern id="contourPattern" x="0" y="0" width="1000" height="1000" patternUnits="userSpaceOnUse">
                        <g fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1.2">
                            {/* Group 1: Flowing waves */}
                            <path d="M0 150 C 200 50, 400 250, 600 150 S 800 50, 1000 150" />
                            <path d="M0 180 C 200 80, 400 280, 600 180 S 800 80, 1000 180" />
                            <path d="M0 210 C 200 110, 400 310, 600 210 S 800 110, 1000 210" />
                            
                            {/* Group 2: Circular elevations (Islands) */}
                            <ellipse cx="250" cy="550" rx="100" ry="60" />
                            <ellipse cx="250" cy="550" rx="150" ry="90" />
                            <ellipse cx="250" cy="550" rx="200" ry="120" />
                            
                            <ellipse cx="750" cy="400" rx="80" ry="120" />
                            <ellipse cx="750" cy="400" rx="120" ry="180" />
                            <ellipse cx="750" cy="400" rx="160" ry="240" />

                            {/* Group 3: Bottom flowing lines */}
                            <path d="M0 800 Q 250 700 500 800 T 1000 800" />
                            <path d="M0 830 Q 250 730 500 830 T 1000 830" />
                            <path d="M0 860 Q 250 760 500 860 T 1000 860" />
                            
                            {/* Corner connectors to help with seamless tiling */}
                            <path d="M900 0 Q 950 100 1000 0" />
                            <path d="M0 0 Q 50 100 100 0" />
                        </g>
                    </pattern>

                    {/* Secondary Overlay: Larger, very faint lines to break the 1000px grid repeat */}
                    <pattern id="contourOverlay" x="200" y="200" width="1600" height="1600" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
                        <g fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="2">
                            <path d="M-100 400 C 300 200, 700 800, 1200 400 S 1700 200, 2000 400" />
                            <path d="M-100 450 C 300 250, 700 850, 1200 450 S 1700 250, 2000 450" />
                        </g>
                    </pattern>
                </defs>

                {/* Fill the entire background with the contour pattern */}
                <rect width="100%" height="100%" fill="url(#contourPattern)" />
                <rect width="100%" height="100%" fill="url(#contourOverlay)" />
            </svg>
        </div>
    );
};

export default MagazineBackground;
