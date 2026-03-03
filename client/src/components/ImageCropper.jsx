import React, { useState, useRef, useEffect } from 'react';

const ImageCropper = ({ imageSrc, onCropComplete, onCancel }) => {
    const [image, setImage] = useState(null);
    const containerRef = useRef(null);
    const imgRef = useRef(null);

    // Crop state in CSS pixels relative to the image display size
    const [crop, setCrop] = useState({ x: 0, y: 0, size: 100 });
    const [imgLoaded, setImgLoaded] = useState(false);

    // Dragging state
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [startCrop, setStartCrop] = useState({ x: 0, y: 0, size: 0 });

    useEffect(() => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            setImage(img);
        };
    }, [imageSrc]);

    // Initialize crop box to center when image renders
    const onImageLoad = () => {
        if (imgRef.current) {
            const { width, height } = imgRef.current;
            const size = Math.min(width, height) * 0.8; // Initial size 80% of smallest dimension
            const x = (width - size) / 2;
            const y = (height - size) / 2;
            setCrop({ x, y, size });
            setImgLoaded(true);
        }
    };

    // --- Interaction Logic ---

    const getClientPos = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    const handleStart = (e, action) => {
        e.preventDefault(); // Stop default scroll/selection
        const pos = getClientPos(e);
        setStartPos(pos);
        setStartCrop({ ...crop });
        if (action === 'move') setIsDragging(true);
        if (action === 'resize') setIsResizing(true);
    };

    const handleMove = (e) => {
        if (!isDragging && !isResizing) return;
        if (!imgRef.current) return;

        const pos = getClientPos(e);
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;

        const imgRect = imgRef.current.getBoundingClientRect();
        const maxX = imgRef.current.width;
        const maxY = imgRef.current.height;

        if (isDragging) {
            let newX = startCrop.x + dx;
            let newY = startCrop.y + dy;

            // Bounds checks
            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX + crop.size > maxX) newX = maxX - crop.size;
            if (newY + crop.size > maxY) newY = maxY - crop.size;

            setCrop(prev => ({ ...prev, x: newX, y: newY }));
        }

        if (isResizing) {
            // Resize maintains aspect ratio (square)
            // We'll use the maximum displacement to determine growth/shrink
            // For bottom-right handle: positive dx/dy means grow
            const delta = Math.max(dx, dy);
            let newSize = startCrop.size + delta;

            // Min size check
            if (newSize < 50) newSize = 50;

            // Max bounds check (cannot exceed image width/height starting from x,y)
            if (crop.x + newSize > maxX) newSize = maxX - crop.x;
            if (crop.y + newSize > maxY) newSize = maxY - crop.y;

            setCrop(prev => ({ ...prev, size: newSize }));
        }
    };

    const handleEnd = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    const handleCropConfirm = () => {
        if (!imgRef.current || !image) return;

        // Calculate actual coordinates
        // displayed width vs natural width
        const scaleX = image.naturalWidth / imgRef.current.width;
        const scaleY = image.naturalHeight / imgRef.current.height;

        const canvas = document.createElement('canvas');
        canvas.width = crop.size * scaleX;
        canvas.height = crop.size * scaleY;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            image,
            crop.x * scaleX, crop.y * scaleY, // Source X, Y
            crop.size * scaleX, crop.size * scaleY, // Source W, H
            0, 0, // Dest X, Y
            canvas.width, canvas.height // Dest W, H
        );

        canvas.toBlob((blob) => {
            const file = new File([blob], "profile_cropped.jpg", { type: "image/jpeg" });
            onCropComplete(file);
        }, 'image/jpeg', 0.95);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)', zIndex: 10000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            userSelect: 'none'
        }}
            onClick={(e) => e.stopPropagation()}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            onTouchCancel={handleEnd}
        >
            <div style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '70vh',
                overflow: 'hidden',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                background: '#000'
            }}>
                <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Crop target"
                    onLoad={onImageLoad}
                    style={{
                        display: 'block',
                        maxWidth: '100%',
                        maxHeight: '70vh',
                        pointerEvents: 'none' // Let events pass to overlay or handle manually
                    }}
                />

                {imgLoaded && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0
                    }}>
                        {/* The Cutout Mask Effect using Box Shadow */}
                        <div
                            style={{
                                position: 'absolute',
                                left: crop.x,
                                top: crop.y,
                                width: crop.size,
                                height: crop.size,
                                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)', // Darken outside
                                border: '2px solid rgba(255,255,255,0.8)',
                                cursor: 'move',
                                touchAction: 'none'
                            }}
                            onMouseDown={(e) => handleStart(e, 'move')}
                            onTouchStart={(e) => handleStart(e, 'move')}
                        >
                            {/* Grid Lines (Visual Feedback) */}
                            <div style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
                            <div style={{ position: 'absolute', top: '66%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
                            <div style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
                            <div style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }}></div>

                            {/* Resize Handle (Bottom-Right) */}
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: '-10px', right: '-10px',
                                    width: '30px', height: '30px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'nwse-resize',
                                    touchAction: 'none',
                                    zIndex: 10
                                }}
                                onMouseDown={(e) => { e.stopPropagation(); handleStart(e, 'resize'); }}
                                onTouchStart={(e) => { e.stopPropagation(); handleStart(e, 'resize'); }}
                            >
                                <div style={{ width: '16px', height: '16px', background: '#2a9d8f', borderRadius: '50%', border: '2px solid white' }}></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div style={{
                marginTop: '20px',
                display: 'flex',
                gap: '15px',
                width: '90%',
                maxWidth: '400px'
            }}>
                <button
                    onClick={onCancel}
                    style={{
                        flex: 1, padding: '12px',
                        background: 'rgba(255,255,255,0.2)', color: 'white',
                        border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px',
                        cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    إلغاء
                </button>
                <button
                    onClick={handleCropConfirm}
                    style={{
                        flex: 1, padding: '12px',
                        background: '#2a9d8f',
                        color: 'white',
                        border: 'none', borderRadius: '12px',
                        cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    حفظ الصورة
                </button>
            </div>

            <div style={{ marginTop: '15px', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                اسحب المربع للتحريك، أو الدائرة في الزاوية لتغيير الحجم
            </div>
        </div>
    );
};

export default ImageCropper;
