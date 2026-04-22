import React from 'react';

const MagazineBackground = () => {
    return (
        <div className="magazine-svg-bg">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    {/* Main Pattern: Large and subtle flowing topographic lines */}
                    <pattern id="topoPattern1" x="0" y="0" width="1000" height="1000" patternUnits="userSpaceOnUse" patternTransform="scale(1.2) rotate(15)">
                        <g fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5">
                            <path d="M100 200 C 300 100, 500 400, 900 300 S 1100 600, 1300 400" />
                            <path d="M150 250 C 350 150, 550 450, 950 350 S 1150 650, 1350 450" />
                            <path d="M200 300 C 400 200, 600 500, 1000 400 S 1200 700, 1400 500" />
                            <path d="M50 800 C 250 700, 450 900, 850 800 S 1050 1100, 1250 900" />
                            <path d="M0 500 C 200 400, 400 700, 700 600 S 900 900, 1100 700" />
                            <path d="M300 0 Q 500 200 700 0 T 1100 0" />
                        </g>
                    </pattern>

                    {/* Secondary Pattern: Smaller and denser features to add texture */}
                    <pattern id="topoPattern2" x="100" y="100" width="600" height="600" patternUnits="userSpaceOnUse" patternTransform="scale(0.8) rotate(-10)">
                        <g fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1">
                            <circle cx="300" cy="300" r="100" />
                            <circle cx="300" cy="300" r="150" />
                            <circle cx="300" cy="300" r="200" />
                            <circle cx="300" cy="300" r="250" />
                            <path d="M0 0 L 600 600" opacity="0.1" />
                            <path d="M600 0 L 0 600" opacity="0.1" />
                        </g>
                    </pattern>

                    {/* Accent Layer: Large features to cover edges and break repetition */}
                    <pattern id="topoPattern3" x="0" y="0" width="1500" height="1500" patternUnits="userSpaceOnUse">
                        <g fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2">
                            <path d="M-100 1200 Q 400 800 900 1200 T 1600 1200" />
                            <path d="M-100 1300 Q 400 900 900 1300 T 1600 1300" />
                            <path d="M-100 1400 Q 400 1000 900 1400 T 1600 1400" />
                            <path d="M800 -100 Q 1100 400 800 900 T 800 1600" />
                        </g>
                    </pattern>
                </defs>

                {/* Applying the layered patterns for a rich, full-screen coverage */}
                <rect width="100%" height="100%" fill="url(#topoPattern1)" />
                <rect width="100%" height="100%" fill="url(#topoPattern2)" />
                <rect width="100%" height="100%" fill="url(#topoPattern3)" />
            </svg>
        </div>
    );
};

export default MagazineBackground;
