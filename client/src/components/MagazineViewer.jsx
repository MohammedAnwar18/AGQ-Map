import React, { useState, useEffect } from 'react';
import './MagazineEditor.css';
import { magazineService, getImageUrl } from '../services/api';

const MagazineViewer = ({ magazineId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await magazineService.getMagazineById(magazineId);
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
    if (!data) return <div className="magazine-error">لم يتم العثور على المجلة</div>;

    const leftElements = data.pages.find(p => p.page_number === 1)?.content?.elements || [];
    const rightElements = data.pages.find(p => p.page_number === 2)?.content?.elements || [];

    return (
        <div className="magazine-viewer">
            <div className="book-canvas">
                <div className="page-spread">
                    <div className="page-canvas left">
                        {leftElements.map(el => (
                            <ViewerElement key={el.id} el={el} />
                        ))}
                    </div>
                    <div className="page-spine"></div>
                    <div className="page-canvas right">
                        {rightElements.map(el => (
                            <ViewerElement key={el.id} el={el} />
                        ))}
                    </div>
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
                <div dangerouslySetInnerHTML={{ __html: el.content }} />
            ) : el.type === 'image' ? (
                <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : el.type === 'shape' ? (
                <div style={{ width: '100%', height: '100%', background: el.styles.backgroundColor, border: el.styles.borderWidth + ' solid ' + el.styles.borderColor, borderRadius: el.styles.borderRadius }}></div>
            ) : null}
        </div>
    );
};

export default MagazineViewer;
