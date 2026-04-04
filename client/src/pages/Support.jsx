import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './LegalPages.css'; 

const Support = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const os = queryParams.get('os') || 'android'; 

    const isIOS = os === 'ios';

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary, #0f172a)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px',
            fontFamily: 'inherit'
        }}>
            <div style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
                <button 
                    onClick={() => navigate('/map')}
                    style={{
                        position: 'absolute', top: '10px', left: '0',
                        background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
                        padding: '8px 15px', borderRadius: '20px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    العودة للخريطة
                </button>
                
                <div style={{ textAlign: 'center', marginTop: '60px' }}>
                    <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>
                        {isIOS ? (
                            <svg viewBox="0 0 24 24" width="60" height="60" fill="currentColor"><path d="M16.96,18.06c-0.78,1.14-1.61,2.27-2.85,2.3c-1.21,0.03-1.62-0.71-2.99-0.71c-1.37,0-1.81,0.68-2.95,0.71 c-1.2,0-1.95-1.04-2.73-2.18c-1.61-2.32-2.84-6.55-1.19-9.42c0.82-1.42,2.26-2.33,3.84-2.36c1.17-0.03,2.27,0.78,2.99,0.78 c0.72,0,2.05-1,3.46-0.85c1.47,0.06,2.8,0.71,3.54,1.82c-3.08,1.86-2.58,6.23,0.5,7.41C18.17,16.48,17.6,17.33,16.96,18.06z M14.61,4.64c0.63-0.76,1.06-1.83,0.94-2.89c-0.93,0.04-2.04,0.62-2.69,1.41C12.3,3.85,11.8,4.96,11.96,5.99 C12.98,6.07,14.03,5.43,14.61,4.64z" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="60" height="60" fill="currentColor" style={{ color: '#3ddc84' }}><path d="M17.6,9.48l1.84-3.18c0.16-0.31,0.04-0.69-0.26-0.85c-0.29-0.15-0.65-0.06-0.83,0.22l-1.88,3.24 c-2.86-1.21-6.08-1.21-8.94,0L5.65,5.67C5.46,5.4,5.1,5.31,4.82,5.46C4.52,5.62,4.4,6,4.56,6.3l1.84,3.18 C2.69,11.56,0,16.2,0,21.5h24C24,16.2,21.31,11.56,17.6,9.48z M6.42,17.43c-0.65,0-1.18-0.53-1.18-1.18 c0-0.65,0.53-1.18,1.18-1.18s1.18,0.53,1.18,1.18C7.59,16.9,7.06,17.43,6.42,17.43z M17.58,17.43c-0.65,0-1.18-0.53-1.18-1.18 c0-0.65,0.53-1.18,1.18-1.18s1.18,0.53,1.18,1.18C18.76,16.9,18.23,17.43,17.58,17.43z" /></svg>
                        )}
                    </div>
                    <h1 style={{ fontSize: '1.8rem', marginBottom: '5px', fontWeight: 'bold' }}>دعم {isIOS ? 'آيفون (iOS)' : 'أندرويد (Android)'}</h1>
                    <p style={{ color: '#94a3b8', marginBottom: '40px' }}>خطوات تفعيل الموقع لتعمل الخريطة بشكل صحيح</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {isIOS ? (
                        <>
                            <StepCard number="1" title="افتح الإعدادات" desc="اذهب إلى إعدادات الهاتف الأساسية (Settings)." />
                            <StepCard number="2" title="الخصوصية والأمن" desc="انزل لأسفل واضغط على خيار (Privacy & Security)." />
                            <StepCard number="3" title="خدمات الموقع" desc="اضغط على (Location Services) وتأكد من تفعيلها." />
                            <StepCard number="4" title="سفاري / المتصفح" desc="في نفس القائمة، ابحث عن المتصفح وحدد الخيار (أثناء استخدام التطبيق)." />
                        </>
                    ) : (
                        <>
                            <StepCard number="1" title="افتح الإعدادات" desc="اذهب إلى تطبيق الإعدادات (Settings) في هاتفك." />
                            <StepCard number="2" title="الموقع" desc="ابحث عن خيار (الموقع) أو (Location) واضغط عليه للتفعيل." />
                            <StepCard number="3" title="المتصفح (Chrome)" desc="افتح المتصفح، اضغط على النقاط الثلاث ثم الإعدادات > إعدادات المواقع." />
                            <StepCard number="4" title="السماح للموقع" desc="ابحث عن PalNovaa في القائمة واضغط على خيار (سماح)." />
                        </>
                    )}
                </div>

                <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'center' }}>
                    <button 
                        onClick={() => window.location.href = '/map'}
                        style={{
                            background: '#fbab15', color: 'black', border: 'none',
                            padding: '15px 30px', borderRadius: '30px', fontSize: '1.2rem',
                            fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(251, 171, 21, 0.4)'
                        }}
                    >
                        جاهز؟ دعنا نعود للخريطة
                    </button>
                </div>
            </div>
        </div>
    );
};

const StepCard = ({ number, title, desc }) => (
    <div style={{
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: '16px', padding: '20px', display: 'flex',
        alignItems: 'center', gap: '15px'
    }}>
        <div style={{
            background: 'var(--bg-primary, #0f172a)', width: '50px', height: '50px',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 'bold', color: '#fbab15', flexShrink: 0, border: '2px solid #334155'
        }}>
            {number}
        </div>
        <div>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {title}
            </h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>{desc}</p>
        </div>
    </div>
);

export default Support;
