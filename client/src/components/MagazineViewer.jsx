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
    if (!data || !data.pages || data.pages.length === 0) return <div className="magazine-error">لم يتم العثور على صفحات في هذه المجلة</div>;

    const totalPages = data.pages.length;
    const currentPages = isMobile 
        ? [data.pages[currentPageIndex]]
        : [data.pages[currentPageIndex], data.pages[currentPageIndex + 1]].filter(Boolean);

    const nextPageIndex = () => {
        const step = isMobile ? 1 : 2;
        if (currentPageIndex + step < totalPages) {
            setCurrentPageIndex(currentPageIndex + step);
        }
    };

    const prevPageIndex = () => {
        const step = isMobile ? 1 : 2;
        if (currentPageIndex - step >= 0) {
            setCurrentPageIndex(currentPageIndex - step);
        }
    };

    return (
        <div className="magazine-viewer" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div className="viewer-controls" style={{ position: 'absolute', bottom: '20px', display: 'flex', gap: '20px', zIndex: 10 }}>
                <button 
                    onClick={prevPageIndex} 
                    disabled={currentPageIndex === 0}
                    style={{ background: 'rgba(212, 175, 55, 0.8)', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', opacity: currentPageIndex === 0 ? 0.3 : 1 }}
                >
                    السابق
                </button>
                <span style={{ color: 'white', fontWeight: 'bold' }}>
                    {isMobile 
                        ? `صفحة ${currentPageIndex + 1} من ${totalPages}` 
                        : `صفحات ${currentPageIndex + 1}-${Math.min(currentPageIndex + 2, totalPages)} من ${totalPages}`
                    }
                </span>
                <button 
                    onClick={nextPageIndex} 
                    disabled={currentPageIndex + (isMobile ? 1 : 2) >= totalPages}
                    style={{ background: 'rgba(212, 175, 55, 0.8)', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', opacity: currentPageIndex + (isMobile ? 1 : 2) >= totalPages ? 0.3 : 1 }}
                >
                    التالي
                </button>
            </div>

            <div className="book-canvas" style={{ 
                width: isMobile ? '350px' : '850px', 
                minHeight: isMobile ? '500px' : '600px',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div className="page-spread" style={{ flexDirection: isMobile ? 'column' : 'row' }}>
                    {currentPages.map((page, idx) => (
                        <React.Fragment key={page.id || page.page_number}>
                            <div className={`page-canvas ${isMobile ? 'single' : (idx === 0 ? 'left' : 'right')}`} style={{ flex: 1, position: 'relative', height: isMobile ? '100%' : 'auto' }}>
                                {(page.content?.elements || []).map(el => (
                                    <ViewerElement key={el.id} el={el} />
                                ))}
                            </div>
                            {!isMobile && idx === 0 && currentPages.length > 1 && <div className="page-spine"></div>}
                        </React.Fragment>
                    ))}
                </div>
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
