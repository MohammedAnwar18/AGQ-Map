import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const ProductScanner = ({ shopId, products, onClose, onFinish }) => {
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('');
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
        setStatus('جاري معاقبة الصورة...');
        
        // Progress steps simulation for better UX
        const steps = ['جاري استخراج النصوص...', 'جاري البحث في المخزن...', 'جاري حساب الإجمالي...'];
        let stepIdx = 0;
        const interval = setInterval(() => {
            if (stepIdx < steps.length) {
                setStatus(steps[stepIdx]);
                stepIdx++;
            }
        }, 1000);

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
            clearInterval(interval);
            setIsProcessing(false);
            setStatus('');
        }
    };

    const reset = () => {
        setImgSrc(null);
        setResults(null);
        setError(null);
        setStatus('');
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ 
                width: '100%', 
                maxWidth: '500px', 
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '30px',
                borderRadius: '30px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ marginBottom: '25px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', background: 'linear-gradient(to right, #fbab15, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        الماسح الذكي للبيانات
                    </h2>
                    <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                        استخدم الكاميرا للتعرف على المنتجات وتسجيلها
                    </p>
                </div>

                {!imgSrc ? (
                    <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', border: '2px solid rgba(251, 171, 21, 0.5)', boxShadow: '0 0 20px rgba(251, 171, 21, 0.2)' }}>
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            style={{ width: '100%', display: 'block' }}
                        />
                        
                        {/* Scanning Laser Animation */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '2px',
                            background: '#fbab15',
                            boxShadow: '0 0 15px 2px #fbab15',
                            animation: 'scan-line 3s infinite linear',
                            zIndex: 10
                        }} />

                        <div style={{
                            position: 'absolute',
                            bottom: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 20
                        }}>
                            <button 
                                onClick={capture}
                                style={{
                                    width: '70px',
                                    height: '70px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 0 25px rgba(255,255,255,0.4)',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
                            >
                                <div style={{ width: '58px', height: '58px', borderRadius: '50%', border: '2px solid #333' }} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', border: '2px solid rgba(251, 171, 21, 0.5)' }}>
                        <img src={imgSrc} style={{ width: '100%', display: 'block', opacity: isProcessing ? 0.6 : 1 }} alt="Captured" />
                        
                        {isProcessing && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <div className="spinner-ai" />
                                <p style={{ marginTop: '15px', fontWeight: '600', animation: 'pulse 1.5s infinite' }}>{status}</p>
                            </div>
                        )}
                    </div>
                )}

                {results && (
                    <div style={{ 
                        marginTop: '25px', 
                        backgroundColor: 'rgba(255,255,255,0.1)', 
                        backdropFilter: 'blur(5px)',
                        padding: '20px', 
                        borderRadius: '20px',
                        textAlign: 'right',
                        border: '1px solid rgba(255,255,255,0.1)',
                        animation: 'slideUp 0.4s ease-out'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div style={{ background: '#22c55e', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                تم التحقق ✓
                            </div>
                            <h3 style={{ margin: 0, color: '#fbab15', fontSize: '1.1rem' }}>النتائج المكتشفة</h3>
                        </div>

                        <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
                            {results.detected.length > 0 ? results.detected.map((item, idx) => (
                                <div key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '12px 0', 
                                    borderBottom: '1px solid rgba(255,255,255,0.05)' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                                            {item.image_url && <img src={item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>ID: #{item.id}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: '800', color: '#fbab15' }}>{item.price} ₪</div>
                                </div>
                            )) : (
                                <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px' }}>
                                    لم يتم العثور على منتجات مطابقة في القائمة.
                                </p>
                            )}
                        </div>

                        <div style={{ 
                            marginTop: '15px',
                            paddingTop: '15px',
                            borderTop: '2px dashed rgba(255,255,255,0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>{results.total} ₪</div>
                            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>المجموع الإجمالي:</div>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ 
                        marginTop: '20px', 
                        padding: '15px', 
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', 
                        borderRadius: '12px',
                        color: '#f87171',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Footer Actions */}
                <div style={{ marginTop: '30px', display: 'flex', gap: '12px' }}>
                    <button 
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '14px',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    >
                        إغلاق
                    </button>
                    
                    {imgSrc && !isProcessing && (
                        <button 
                            onClick={results ? () => onFinish(results) : reset}
                            style={{
                                flex: 2,
                                padding: '14px',
                                borderRadius: '16px',
                                border: 'none',
                                backgroundColor: '#fbab15',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                boxShadow: '0 10px 20px -5px rgba(251, 171, 21, 0.4)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            {results ? 'تأكيد السلة' : 'إعادة المحاولة'}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { top: 0; opacity: 0; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                .spinner-ai {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(251, 171, 21, 0.1);
                    border-left-color: #fbab15;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ProductScanner;

