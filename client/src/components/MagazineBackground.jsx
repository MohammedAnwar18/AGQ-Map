import React from 'react';

const MagazineBackground = () => {
    return (
        <div className="magazine-svg-bg">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    {/* 
                        Recreating the exact contour map look from the user's reference image.
                        Features: Clean wavy lines, concentric islands, and varying stroke widths.
                    */}
                    <pattern id="premiumContourPattern" x="0" y="0" width="800" height="800" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
                        <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
                            {/* Layer 1: Base thin lines (Higher density) */}
                            <g opacity="0.15" strokeWidth="1">
                                <path d="M-100 100 C 100 50, 300 150, 500 100 S 800 50, 900 100" />
                                <path d="M-100 130 C 100 80, 300 180, 500 130 S 800 80, 900 130" />
                                <path d="M-100 160 C 100 110, 300 210, 500 160 S 800 110, 900 160" />
                                
                                <path d="M-100 500 C 150 450, 350 650, 600 500 S 850 450, 1000 500" />
                                <path d="M-100 530 C 150 480, 350 680, 600 530 S 850 480, 1000 530" />
                                <path d="M-100 560 C 150 510, 350 710, 600 560 S 850 510, 1000 560" />

                                {/* Concentric Island 1 (Top Right-ish) */}
                                <ellipse cx="600" cy="250" rx="40" ry="25" />
                                <ellipse cx="600" cy="250" rx="80" ry="50" />
                                <ellipse cx="600" cy="250" rx="120" ry="75" />
                                <ellipse cx="600" cy="250" rx="160" ry="100" />
                                
                                {/* Concentric Island 2 (Bottom Left-ish) */}
                                <ellipse cx="200" cy="650" rx="50" ry="30" />
                                <ellipse cx="200" cy="650" rx="100" ry="60" />
                                <ellipse cx="200" cy="650" rx="150" ry="90" />
                                <ellipse cx="200" cy="650" rx="200" ry="120" />
                            </g>

                            {/* Layer 2: Accented thicker lines (Lower density) */}
                            <g opacity="0.25" strokeWidth="2">
                                <path d="M-100 190 C 100 140, 300 240, 500 190 S 800 140, 900 190" />
                                <path d="M-100 590 C 150 540, 350 740, 600 590 S 850 540, 1000 590" />
                                
                                <ellipse cx="600" cy="250" rx="200" ry="125" />
                                <ellipse cx="200" cy="650" rx="250" ry="150" />
                            </g>

                            {/* Layer 3: Extra wavy connectors for a continuous look */}
                            <g opacity="0.1" strokeWidth="1">
                                <path d="M400 -100 C 350 150, 550 350, 400 600 S 350 850, 400 1000" />
                                <path d="M430 -100 C 380 150, 580 350, 430 600 S 380 850, 430 1000" />
                            </g>
                        </g>
                    </pattern>
                </defs>

                {/* Applying the refined premium contour pattern across the full interface */}
                <rect width="100%" height="100%" fill="url(#premiumContourPattern)" />
            </svg>
        </div>
    );
};

export default MagazineBackground;
