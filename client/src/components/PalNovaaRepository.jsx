import React, { useState } from 'react';
import { Warp } from "@paper-design/shaders-react";
import './PalNovaaRepository.css';

const PalNovaaRepository = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) return;
        setIsSubmitting(true);
        // Simulate API call
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSuccess(true);
            setEmail('');
        }, 1200);
    };

    return (
        <div className="repository-overlay-container">
            {/* Close Button */}
            <button className="repository-close-btn" onClick={onClose} title="إغلاق">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            {/* Background shader */}
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
            
            {/* Vignette Overlay */}
            <div className="repository-shader-overlay"></div>

            {/* Centered Glass Card */}
            <div className="repository-content-card">
                <span className="repository-tag">ميزة جديدة قادمة</span>
                
                <h1 className="repository-title">مستودع بالنوفا</h1>
                <div className="repository-subtitle">PalNovaa Repository</div>
                
                <p className="repository-description">
                    نعمل حالياً على تطوير مستودع بالنوفا الرقمي المخصص لمشاركة وتحميل الطبقات الجغرافية، الخرائط التفاعلية الجاهزة، وأدوات التحليل الجغرافي المتقدمة. اشترك بنشرتنا البريدية لتكون أول من يحصل على إشعار عند إطلاق الخدمة.
                </p>

                {!isSuccess ? (
                    <form onSubmit={handleSubmit} className="repository-input-wrapper">
                        <input
                            type="email"
                            required
                            placeholder="أدخل بريدك الإلكتروني للاشتراك"
                            className="repository-email-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isSubmitting}
                        />
                        <button type="submit" className="repository-submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="spinner" style={{ display: 'block', width: '20px', height: '20px', border: '3px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                            ) : (
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="repository-success-alert">
                        🎉 شكراً لك! تم تسجيل بريدك الإلكتروني بنجاح. سنعلمك فور إطلاق المستودع.
                    </div>
                )}

                <div className="repository-footer-text">
                    لن نقوم بإرسال رسائل مزعجة، ويمكنك إلغاء الاشتراك في أي وقت.
                </div>
            </div>
            
            {/* Inline keyframe animation for spinner */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
};

export default PalNovaaRepository;
