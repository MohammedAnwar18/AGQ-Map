import React, { useState, useEffect } from 'react';
import './MagazineEditor.css';
import { magazineService, getImageUrl } from '../services/api';
import axios from 'axios';
import { MagazineElementRenderer } from './MagazineElementRenderer';

const MagazineViewer = ({ magazineId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await magazineService.getMagazineById(magazineId);
                if (res.pages) res.pages.sort((a, b) => a.page_number - b.page_number);
                setData(res);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        load();
    }, [magazineId]);

    if (loading) return <div className="magazine-loading">جاري تحميل المجلة...</div>;
    if (!data || !data.pages || data.pages.length === 0) return <div className="magazine-error">لا توجد صفحات</div>;

    const totalPages = data.pages.length;
    const isCover = currentPageIndex === 0;
    const currentPages = (isCover || isMobile)
        ? [data.pages[currentPageIndex]]
        : [data.pages[currentPageIndex], data.pages[currentPageIndex + 1]].filter(Boolean);

    return (
        <div className="magazine-viewer" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', fontFamily: "'Tajawal', sans-serif" }}>
            <div className="viewer-header" style={{ position: 'absolute', top: '20px', textAlign: 'center', width: '100%', pointerEvents: 'none' }}>
                <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.8rem', margin: 0, background: 'linear-gradient(135deg, #fff, #d4af37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '800' }}>مجلة بالنوفا المكانية</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', margin: '5px 0' }}>العدد: {data.magazine?.title}</p>
            </div>

            <div className="book-canvas" style={{ width: (isCover || isMobile) ? (isMobile ? '90%' : '450px') : '900px', minHeight: isMobile ? '500px' : '650px', transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
                <div className="page-spread" style={{ flexDirection: isMobile ? 'column' : 'row', height: '100%' }}>
                    {currentPages.map((page, idx) => (
                        <React.Fragment key={page.id || page.page_number}>
                            <div className={`page-canvas ${isCover || isMobile ? 'single' : (idx === 0 ? 'left' : 'right')}`} style={{ flex: 1, position: 'relative', background: isCover ? '#fff' : '#fefefe', overflow: 'hidden' }}>
                                {(page.content?.elements || []).map(el => (
                                    <MagazineElementRenderer key={el.id} el={el} />
                                ))}
                            </div>
                            {!isMobile && !isCover && idx === 0 && currentPages.length > 1 && <div className="page-spine"></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="viewer-controls" style={{ position: 'absolute', bottom: isMobile ? '30px' : '40px', display: 'flex', alignItems: 'center', gap: '20px', zIndex: 10, background: 'rgba(21, 21, 29, 0.8)', padding: '10px 20px', borderRadius: '30px', backdropFilter: 'blur(10px)', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <button onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - (isMobile ? 1 : 2)))} disabled={currentPageIndex === 0} style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', opacity: currentPageIndex === 0 ? 0.3 : 1, fontSize: '1.5rem' }}>→</button>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{isCover ? 'الغلاف' : `صفحة ${currentPageIndex + 1}`}</span>
                <button onClick={() => setCurrentPageIndex(currentPageIndex + (isCover ? 1 : (isMobile ? 1 : 2)))} disabled={isCover ? totalPages <= 1 : (currentPageIndex + (isCover ? 1 : (isMobile ? 1 : 2)) >= totalPages)} style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', opacity: (isCover ? totalPages <= 1 : (currentPageIndex + (isCover ? 1 : (isMobile ? 1 : 2)) >= totalPages)) ? 0.3 : 1, fontSize: '1.5rem' }}>←</button>
            </div>
        </div>
    );
};

export default MagazineViewer;
