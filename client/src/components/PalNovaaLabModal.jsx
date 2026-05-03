import React, { useState } from 'react';

const PalNovaaLabModal = ({ onClose, onDataLoaded, onClearData, currentData }) => {
    const [error, setError] = useState(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (json.type === 'FeatureCollection' || json.type === 'Feature') {
                    onDataLoaded(json);
                    onClose();
                } else {
                    setError('الملف المرفق ليس بصيغة GeoJSON صحيحة.');
                }
            } catch (err) {
                setError('حدث خطأ أثناء قراءة الملف. تأكد من أنه ملف JSON/GeoJSON صالح.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                background: '#15151d', width: '90%', maxWidth: '400px',
                borderRadius: '20px', padding: '20px', color: 'white',
                border: '1px solid rgba(251, 171, 21, 0.3)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                fontFamily: "'Tajawal', sans-serif",
                position: 'relative'
            }}>
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '15px', right: '15px',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        color: 'white', width: '30px', height: '30px',
                        borderRadius: '50%', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    ✕
                </button>
                
                <h2 style={{ textAlign: 'center', color: '#fbab15', marginBottom: '10px' }}>مختبر بالنوفا (PalNovaa Lab)</h2>
                <p style={{ textAlign: 'center', fontSize: '14px', color: '#aaa', marginBottom: '20px' }}>
                    قم برفع ملفات GeoJSON לעرضها مباشرة على الخريطة دون حفظها في قاعدة البيانات.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <label style={{
                        background: 'rgba(251, 171, 21, 0.1)', border: '2px dashed #fbab15',
                        borderRadius: '10px', padding: '30px 20px', textAlign: 'center',
                        cursor: 'pointer', transition: 'all 0.3s'
                    }}>
                        <input 
                            type="file" 
                            accept=".json,.geojson" 
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fbab15" strokeWidth="2" width="40" height="40" style={{ marginBottom: '10px' }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <div style={{ color: '#fbab15', fontWeight: 'bold' }}>اختر ملف GeoJSON</div>
                    </label>

                    {error && <div style={{ color: '#ef4444', textAlign: 'center', fontSize: '13px' }}>{error}</div>}

                    {currentData && (
                        <button 
                            onClick={() => {
                                onClearData();
                                onClose();
                            }}
                            style={{
                                background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
                                border: '1px solid #ef4444', padding: '10px',
                                borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            إزالة البيانات الحالية من الخريطة
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PalNovaaLabModal;
