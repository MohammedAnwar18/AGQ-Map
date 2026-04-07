import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const ProductScanner = ({ shopId, products, onClose, onFinish }) => {
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    const videoConstraints = {
        width: 1280,
        height: 720,
        facingMode: "environment" // Use back camera on mobile
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
        processImage(imageSrc);
    }, [webcamRef]);

    const processImage = async (image) => {
        setIsProcessing(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/ai/recognize-products', {
                image,
                shopId,
                products
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setResults(response.data);
            } else {
                setError(response.data.message || 'فشل في التعرف على المنتجات');
            }
        } catch (err) {
            console.error(err);
            setError('حدث خطأ أثناء الاتصال بالخادم');
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setImgSrc(null);
        setResults(null);
        setError(null);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            padding: '20px'
        }}>
            <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '20px' }}>الماسح الذكي للمنتجات (Admin)</h2>

                {!imgSrc ? (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '4px solid #fbab15' }}>
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            style={{ width: '100%', display: 'block' }}
                        />
                        <button 
                            onClick={capture}
                            style={{
                                position: 'absolute',
                                bottom: '20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '70px',
                                height: '70px',
                                borderRadius: '50%',
                                border: '5px solid white',
                                backgroundColor: 'rgba(251, 171, 21, 0.8)',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '4px solid #fbab15' }}>
                        <img src={imgSrc} style={{ width: '100%', display: 'block' }} alt="Captured" />
                        {isProcessing && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div className="spinner" style={{ marginBottom: '10px' }}></div>
                                <p>جاري تحليل المنتجات والأسعار...</p>
                            </div>
                        )}
                    </div>
                )}

                {results && (
                    <div style={{ 
                        marginTop: '20px', 
                        backgroundColor: 'white', 
                        color: 'black', 
                        padding: '20px', 
                        borderRadius: '12px',
                        textAlign: 'right'
                    }}>
                        <h3 style={{ color: '#fbab15', marginBottom: '15px' }}>المنتجات المكتشفة:</h3>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '15px' }}>
                            {results.detected.map((item, idx) => (
                                <div key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    padding: '10px 0', 
                                    borderBottom: '1px solid #eee' 
                                }}>
                                    <span>{item.name}</span>
                                    <span style={{ fontWeight: 'bold' }}>{item.price} ILS</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ 
                            fontSize: '1.4rem', 
                            fontWeight: 'bold', 
                            borderTop: '2px solid #fbab15', 
                            paddingTop: '10px',
                            display: 'flex',
                            justifyContent: 'space-between'
                        }}>
                            <span>الإجمالي:</span>
                            <span>{results.total} ILS</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ marginTop: '20px', color: '#ff4d4d', fontWeight: 'bold' }}>
                        {error}
                    </div>
                )}

                <div style={{ marginTop: '30px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
                    <button 
                        onClick={onClose}
                        style={{
                            padding: '12px 25px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#666',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        إلغاء
                    </button>
                    {imgSrc && !isProcessing && (
                        <button 
                            onClick={reset}
                            style={{
                                padding: '12px 25px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#fbab15',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            إعادة المحاولة
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductScanner;
