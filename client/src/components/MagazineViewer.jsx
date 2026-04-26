import React, { useState, useEffect } from 'react';
import './MagazineEditor.css';
import { magazineService, getImageUrl } from '../services/api';

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
                if (res.pages) {
                    res.pages.sort((a, b) => a.page_number - b.page_number);
                }
                setData(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [magazineId]);

    if (loading) return <div className="magazine-loading">جاري تحميل المجلة...</div>;
    if (!data || !data.pages || data.pages.length === 0) return <div className="magazine-error">لم يتم العثور على صفحات</div>;

    const totalPages = data.pages.length;
    
    // Page selection logic: 
    // If index 0 (Cover), show 1 page.
    // If isMobile, show 1 page.
    // Otherwise show 2 pages (starting from index 1, 3, 5...).
    const isCover = currentPageIndex === 0;
    const currentPages = (isCover || isMobile)
        ? [data.pages[currentPageIndex]]
        : [data.pages[currentPageIndex], data.pages[currentPageIndex + 1]].filter(Boolean);

    const nextPageIndex = () => {
        if (isCover) {
            setCurrentPageIndex(1);
        } else {
            const step = isMobile ? 1 : 2;
            if (currentPageIndex + step < totalPages) {
                setCurrentPageIndex(currentPageIndex + step);
            }
        }
    };

    const prevPageIndex = () => {
        if (currentPageIndex === 1) {
            setCurrentPageIndex(0);
        } else {
            const step = isMobile ? 1 : 2;
            if (currentPageIndex - step >= 0) {
                setCurrentPageIndex(currentPageIndex - step);
            }
        }
    };

    return (
        <div className="magazine-viewer" style={{ 
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column', 
            alignItems: 'center', justifyContent: 'center', position: 'relative',
            fontFamily: "'Tajawal', sans-serif" 
        }}>
            {/* Branding Header */}
            <div className="viewer-header" style={{ 
                position: 'absolute', top: '20px', textAlign: 'center', width: '100%',
                pointerEvents: 'none'
            }}>
                <h2 style={{ 
                    fontSize: isMobile ? '1.2rem' : '1.8rem', 
                    margin: 0, 
                    background: 'linear-gradient(135deg, #fff, #d4af37)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '800'
                }}>
                    مجلة بالنوفا المكانية
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', margin: '5px 0' }}>
                    العدد: {data.magazine?.title}
                </p>
            </div>

            <div className="book-canvas" style={{ 
                width: (isCover || isMobile) ? (isMobile ? '90%' : '450px') : '900px', 
                minHeight: isMobile ? '500px' : '650px',
                transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: isCover ? '0 30px 60px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.4)',
                borderRadius: isCover ? '5px 15px 15px 5px' : '10px'
            }}>
                <div className="page-spread" style={{ flexDirection: isMobile ? 'column' : 'row', height: '100%' }}>
                    {currentPages.map((page, idx) => (
                        <React.Fragment key={page.id || page.page_number}>
                            <div className={`page-canvas ${isCover || isMobile ? 'single' : (idx === 0 ? 'left' : 'right')}`} 
                                style={{ 
                                    flex: 1, position: 'relative', 
                                    background: isCover ? 'linear-gradient(135deg, #fff, #f0f0f0)' : 'linear-gradient(135deg, #fefefe, #f8f6f0)',
                                    overflow: 'hidden'
                                }}>
                                {(page.content?.elements || []).map(el => (
                                    <ViewerElement key={el.id} el={el} />
                                ))}
                            </div>
                            {!isMobile && !isCover && idx === 0 && currentPages.length > 1 && <div className="page-spine"></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="viewer-controls" style={{ 
                position: 'absolute', bottom: isMobile ? '30px' : '40px', 
                display: 'flex', alignItems: 'center', gap: '20px', zIndex: 10,
                background: 'rgba(21, 21, 29, 0.8)', padding: '10px 20px',
                borderRadius: '30px', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(212, 175, 55, 0.3)'
            }}>
                <button 
                    onClick={prevPageIndex} 
                    disabled={currentPageIndex === 0}
                    className="nav-btn"
                    style={{ 
                        background: 'none', border: 'none', color: '#d4af37', 
                        cursor: 'pointer', opacity: currentPageIndex === 0 ? 0.3 : 1,
                        fontSize: '1.5rem'
                    }}
                >
                    →
                </button>
                <span style={{ color: 'white', fontWeight: 'bold', minWidth: '100px', textAlign: 'center' }}>
                    {isCover ? 'الغلاف' : `صفحة ${currentPageIndex + 1}`}
                </span>
                <button 
                    onClick={nextPageIndex} 
                    disabled={isCover ? (totalPages <= 1) : (currentPageIndex + (isMobile ? 1 : 2) >= totalPages)}
                    className="nav-btn"
                    style={{ 
                        background: 'none', border: 'none', color: '#d4af37', 
                        cursor: 'pointer', opacity: (isCover ? (totalPages <= 1) : (currentPageIndex + (isMobile ? 1 : 2) >= totalPages)) ? 0.3 : 1,
                        fontSize: '1.5rem'
                    }}
                >
                    ←
                </button>
            </div>
        </div>
    );
};

const ViewerElement = ({ el }) => {
    const style = {
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        ...el.styles,
        fontSize: el.type === 'text' ? `${el.styles.fontSize}px` : undefined,
        fontFamily: el.styles.fontFamily || "'Tajawal', sans-serif"
    };

    return (
        <div className={`${el.type}-element`} style={style}>
            {el.type === 'text' ? (
                <div dangerouslySetInnerHTML={{ __html: el.content.replace(/\n/g, '<br/>') }} />
            ) : el.type === 'image' ? (
                <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : el.type === 'shape' ? (
                <div style={{ width: '100%', height: '100%', background: el.styles.backgroundColor, border: el.styles.borderWidth + ' solid ' + el.styles.borderColor, borderRadius: el.styles.borderRadius }}></div>
            ) : null}
        </div>
    );
};

export default MagazineViewer;
