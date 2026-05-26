import React from 'react';

const DefaultAvatar = ({ gender, size = 110, uid = 'u', style = {} }) => {
    if (gender === 'male') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                {/* Background */}
                <circle cx="50" cy="50" r="50" fill="#ffffff" />
                
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#026a9e" strokeWidth="5" />
                
                {/* Nested Male Symbol SVG */}
                <svg x="25" y="25" width="50" height="50" viewBox="0 -960 960 960">
                    <path d="M400-80v-280h-80v-240q0-33 23.5-56.5T400-680h160q33 0 56.5 23.5T640-600v240h-80v280H400Zm80-640q-33 0-56.5-23.5T400-800q0-33 23.5-56.5T480-880q33 0 56.5 23.5T560-800q0 33-23.5 56.5T480-720Z" fill="#026a9e" />
                </svg>
            </svg>
        );
    }

    if (gender === 'female') {
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
                {/* Background */}
                <circle cx="50" cy="50" r="50" fill="#ffffff" />
                
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#c42f6d" strokeWidth="5" />
                
                {/* Nested Female Symbol SVG */}
                <svg x="25" y="25" width="50" height="50" viewBox="0 -960 960 960">
                    <path d="M400-80v-240H280l122-308q10-24 31-38t47-14q26 0 47 14t31 38l122 308H560v240H400Zm23.5-663.5Q400-767 400-800t23.5-56.5Q447-880 480-880t56.5 23.5Q560-833 560-800t-23.5 56.5Q513-720 480-720t-56.5-23.5Z" fill="#c42f6d" />
                </svg>
            </svg>
        );
    }

    // Neutral / unknown gender
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', display: 'block', ...style }}>
            {/* Background */}
            <circle cx="50" cy="50" r="50" fill="#ffffff" />
            
            {/* Outer Ring */}
            <circle cx="50" cy="50" r="45" fill="none" stroke="#64748b" strokeWidth="5" />
            
            {/* Nested Neutral Symbol SVG */}
            <svg x="25" y="25" width="50" height="50" viewBox="0 -960 960 960">
                <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-240v-80q0-33 17-60.5t47-44.5q67-30 136.5-45t139.5-15q70 0 139.5 15t136.5 45q30 17 47 44.5t17 60.5v80H160Z" fill="#64748b" />
            </svg>
        </svg>
    );
};

export default DefaultAvatar;
