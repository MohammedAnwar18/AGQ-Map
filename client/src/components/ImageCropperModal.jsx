import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './Modal.css'; // Utilizing existing modal styles

// Utility to create image from url
const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });

// Utility to crop image and return File object
async function getCroppedImg(imageSrc, pixelCrop, aspect) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return null;
    }

    // Set canvas size to match the bounding box
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped area on canvas
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // As a blob
    return new Promise((resolve, reject) => {
        canvas.toBlob((file) => {
            if (file) {
                // Ensure it's a File object by giving it a name and lastModified Date
                const finalFile = new File([file], 'cropped-image.jpeg', { type: 'image/jpeg', lastModified: Date.now() });
                resolve(finalFile);
            } else {
                reject(new Error('Canvas toBlob failed'));
            }
        }, 'image/jpeg');
    });
}

const ImageCropperModal = ({ imageFile, aspect = 1, onCropDone, onCancel }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Create a local object URL for the image file
    const [imageSrc, setImageSrc] = useState(null);

    React.useEffect(() => {
        if (imageFile) {
            const tempUrl = URL.createObjectURL(imageFile);
            setImageSrc(tempUrl);
            return () => {
                URL.revokeObjectURL(tempUrl);
            };
        }
    }, [imageFile]);

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleConfirm = async () => {
        try {
            const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, aspect);
            onCropDone(croppedFile);
        } catch (e) {
            console.error('Failed to crop image', e);
            onCancel();
        }
    };

    if (!imageSrc) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-container" style={{ width: '90%', maxWidth: '600px', background: 'var(--bg-primary)', padding: '20px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>قم بتعديل حدود الصورة ✂️</h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                </div>

                <div style={{ position: 'relative', width: '100%', height: '400px', background: '#333', borderRadius: '12px', overflow: 'hidden' }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect} // Make this dynamic, normally 1 for profile and 3 for cover
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>
                
                <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>تصغير</span>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => {
                            setZoom(e.target.value)
                        }}
                        style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>تكبير</span>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                    <button 
                        onClick={onCancel} 
                        style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                        إلغاء
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        style={{ flex: 2, padding: '12px', borderRadius: '10px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                        قص الصورة وحفظ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropperModal;
