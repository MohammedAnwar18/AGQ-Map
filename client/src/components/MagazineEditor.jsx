import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MagazineEditor.css';
import { magazineService, getImageUrl } from '../services/api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import axios from 'axios';
import MagazineViewer from './MagazineViewer';
import MagazineBackground from './MagazineBackground';
import { MagazineElementRenderer, SpatialMapRenderer } from './MagazineElementRenderer';

const MagazineEditor = ({ magazineId, onClose }) => {
    // ==================== STATE MANAGEMENT ====================
    const [pages, setPages] = useState([{ page_number: 1, elements: [] }]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0); 
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [currentResizeHandle, setCurrentResizeHandle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [magazine, setMagazine] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const pageCanvasRef = useRef(null);
    const imageInputRef = useRef(null);
    const spatialInputRef = useRef(null);

    // ==================== INITIALIZATION ====================
    useEffect(() => {
        loadMagazineData();
    }, [magazineId]);

    const loadMagazineData = async () => {
        try {
            setLoading(true);
            const data = await magazineService.getMagazineById(magazineId);
            setMagazine(data.magazine);
            
            if (data.pages && data.pages.length > 0) {
                const sortedPages = data.pages.sort((a, b) => a.page_number - b.page_number)
                    .map(p => ({
                        page_number: p.page_number,
                        elements: p.content.elements || []
                    }));
                setPages(sortedPages);
            } else {
                setPages([{ page_number: 1, elements: [] }]);
            }
            
            setHistory([JSON.stringify(data.pages || [{ page_number: 1, elements: [] }])]);
            setHistoryIndex(0);
        } catch (error) {
            console.error('Failed to load magazine:', error);
            showToast('فشل في تحميل المجلة', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
    };

    const saveState = useCallback((newPages) => {
        const state = JSON.stringify(newPages);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(state);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const undoAction = () => {
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            setPages(JSON.parse(history[prevIndex]));
            setHistoryIndex(prevIndex);
            setSelectedElementId(null);
        }
    };

    const redoAction = () => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setPages(JSON.parse(history[nextIndex]));
            setHistoryIndex(nextIndex);
            setSelectedElementId(null);
        }
    };

    // ==================== PAGE MANAGEMENT ====================
    const addPage = () => {
        const newPages = [...pages, { page_number: pages.length + 1, elements: [] }];
        setPages(newPages);
        setCurrentPageIndex(newPages.length - 1);
        saveState(newPages);
    };

    const deleteCurrentPage = () => {
        if (pages.length <= 1) return;
        if (!window.confirm('حذف الصفحة؟')) return;
        const newPages = pages.filter((_, i) => i !== currentPageIndex).map((p, i) => ({ ...p, page_number: i + 1 }));
        setPages(newPages);
        setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
        saveState(newPages);
    };

    // ==================== ELEMENT CREATION ====================
    const addElement = (elementData) => {
        const newPages = [...pages];
        const newElement = {
            id: `el_${Date.now()}`,
            x: 50, y: 50, width: 200, height: 100,
            ...elementData
        };
        newPages[currentPageIndex].elements.push(newElement);
        setPages(newPages);
        saveState(newPages);
        setSelectedElementId(newElement.id);
    };

    const addTextElement = (type) => {
        const conf = {
            heading: { text: 'عنوان رئيسي', fontSize: 28, fw: 'bold', width: 300, height: 60 },
            subheading: { text: 'عنوان فرعي', fontSize: 20, fw: '600', width: 250, height: 40 },
            paragraph: { text: 'نص المقال هنا...', fontSize: 14, fw: 'normal', width: 300, height: 150 }
        }[type];
        addElement({
            type: 'text', content: conf.text, width: conf.width, height: conf.height,
            styles: { fontSize: conf.fontSize, fontWeight: conf.fw, color: '#1a1a1a', textAlign: 'right', padding: '10px' }
        });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('image', file);
            const { url } = await magazineService.uploadImage(formData);
            addElement({ type: 'image', src: getImageUrl(url), raw_url: url, width: 300, height: 200, styles: { borderRadius: '8px' } });
        } catch (err) { showToast('فشل التحميل', 'danger'); }
    };

    const handleSpatialUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            showToast('جاري معالجة البيانات الجغرافية...', 'success');
            const formData = new FormData();
            formData.append('file', file);
            const res = await magazineService.uploadSpatial(formData);
            
            addElement({
                type: 'spatial',
                spatialDrawing: res.type === 'drawing' ? res.path : null,
                width: 400,
                height: 300,
                theme: 'firefly',
                styles: { backgroundColor: 'transparent', border: 'none' }
            });
            showToast('تمت إضافة الخريطة الفنية');
        } catch (err) { 
            console.error('Spatial upload failed:', err);
            const errorMsg = err.response?.data?.details || err.response?.data?.error || err.response?.data?.message || err.message || 'فشل معالجة الملف. تأكد أنه ZIP يحتوي على .shp';
            showToast(`Error: ${errorMsg}`, 'danger'); 
        }
    };

    const addShapeElement = (shapeType) => {
        addElement({
            type: 'shape', shapeType, width: 150, height: 150,
            styles: { backgroundColor: 'rgba(212, 175, 55, 0.2)', borderColor: '#d4af37', borderWidth: '2px', borderRadius: shapeType === 'circle' ? '50%' : '8px' }
        });
    };

    // ==================== INTERACTION ====================
    const handleMouseDown = (e, id) => {
        if (e.target.classList.contains('resize-handle')) return;
        setSelectedElementId(id);
        setIsDragging(true);
        const el = pages[currentPageIndex].elements.find(el => el.id === id);
        const rect = pageCanvasRef.current.getBoundingClientRect();
        setDragOffset({ x: e.clientX - rect.left - el.x, y: e.clientY - rect.top - el.y });
    };

    const handleResizeStart = (e, id, handle) => {
        e.stopPropagation();
        setSelectedElementId(id);
        setIsResizing(true);
        setCurrentResizeHandle(handle);
    };

    const handleMouseMove = useCallback((e) => {
        if (!selectedElementId) return;
        if (isDragging) {
            const newPages = [...pages];
            const elIndex = newPages[currentPageIndex].elements.findIndex(el => el.id === selectedElementId);
            const rect = pageCanvasRef.current.getBoundingClientRect();
            newPages[currentPageIndex].elements[elIndex].x = e.clientX - rect.left - dragOffset.x;
            newPages[currentPageIndex].elements[elIndex].y = e.clientY - rect.top - dragOffset.y;
            setPages(newPages);
        }
        if (isResizing) {
            const newPages = [...pages];
            const elIndex = newPages[currentPageIndex].elements.findIndex(el => el.id === selectedElementId);
            const el = newPages[currentPageIndex].elements[elIndex];
            const rect = pageCanvasRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            if (currentResizeHandle === 'se') {
                el.width = Math.max(20, mouseX - el.x);
                el.height = Math.max(20, mouseY - el.y);
            }
            setPages(newPages);
        }
    }, [isDragging, isResizing, selectedElementId, pages, currentPageIndex, dragOffset, currentResizeHandle]);

    const handleMouseUp = useCallback(() => {
        if (isDragging || isResizing) {
            setIsDragging(false);
            setIsResizing(false);
            saveState(pages);
        }
    }, [isDragging, isResizing, pages, saveState]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const updateStyle = (prop, val) => {
        const newPages = [...pages];
        const el = newPages[currentPageIndex].elements.find(e => e.id === selectedElementId);
        if (el) {
            el.styles[prop] = val;
            setPages(newPages);
            saveState(newPages);
        }
    };

    const updateSpatialTheme = (theme) => {
        const newPages = [...pages];
        const el = newPages[currentPageIndex].elements.find(e => e.id === selectedElementId);
        if (el) {
            el.theme = theme;
            setPages(newPages);
            saveState(newPages);
        }
    };

    const saveProject = async () => {
        try {
            setLoading(true);
            for (const page of pages) {
                await magazineService.savePage({ magazineId, pageNumber: page.page_number, content: { elements: page.elements } });
            }
            showToast('تم الحفظ بنجاح');
        } catch (err) { showToast('فشل الحفظ', 'danger'); } finally { setLoading(false); }
    };

    if (loading && !magazine) return <div className="magazine-editor-container"><div className="spinner"></div></div>;

    const currentPage = pages[currentPageIndex];
    const selectedEl = currentPage.elements.find(el => el.id === selectedElementId);

    return (
        <div className="magazine-editor-container">
            <header className="editor-header">
                <div className="header-logo">
                    <div className="logo-badge" style={{ background: 'linear-gradient(135deg, #d4af37, #b87333)', color: '#000' }}>PN</div>
                    <span className="logo-text" style={{ background: 'linear-gradient(135deg, #fff, #d4af37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '800' }}>
                        مجلة بالنوفا المكانية
                    </span>
                </div>
                <div className="header-actions">
                    <button className="header-btn" onClick={undoAction}>تراجع</button>
                    <button className="header-btn" onClick={redoAction}>إعادة</button>
                    <button className="header-btn save" onClick={saveProject}>حفظ الكل</button>
                    <button className="header-btn" onClick={onClose}>خروج</button>
                </div>
            </header>

            <div className="editor-layout">
                <aside className="panel">
                    <div className="panel-header">أدوات التصميم</div>
                    <div className="tools-grid">
                        <button className="tool-btn" onClick={() => addTextElement('heading')}>عنوان</button>
                        <button className="tool-btn" onClick={() => addTextElement('paragraph')}>نص</button>
                        <button className="tool-btn" onClick={() => imageInputRef.current.click()}>صورة</button>
                        <button className="tool-btn" onClick={() => spatialInputRef.current.click()} style={{ background: 'rgba(212, 175, 55, 0.2)', borderColor: '#d4af37' }}>
                            <div style={{ fontSize: '18px' }}>🗺️</div>
                            خريطة
                        </button>
                        <button className="tool-btn" onClick={() => addShapeElement('rectangle')}>شكل</button>
                    </div>
                    <div className="divider"></div>
                    <div className="panel-header">الصفحات</div>
                    <div className="page-tabs">
                        {pages.map((p, i) => (
                            <button key={i} className={`page-tab ${currentPageIndex === i ? 'active' : ''}`} onClick={() => setCurrentPageIndex(i)}>
                                {i === 0 ? 'الغلاف' : p.page_number}
                            </button>
                        ))}
                        <button className="page-tab" onClick={addPage}>+</button>
                    </div>
                    <button className="action-btn danger" onClick={deleteCurrentPage} style={{ fontSize: '11px', marginTop: '10px' }}>حذف الصفحة</button>
                </aside>

                <main className="canvas-area">
                    <div className="book-canvas" style={{ width: isMobile ? '95%' : '500px', minHeight: isMobile ? '550px' : '700px' }}>
                        <div className="page-canvas" ref={pageCanvasRef} onMouseDown={(e) => { if (e.target === pageCanvasRef.current) setSelectedElementId(null); }} style={{ width: '100%', height: '100%', position: 'relative' }}>
                            {currentPage.elements.map(el => (
                                <RenderedElement 
                                    key={el.id} el={el} isSelected={selectedElementId === el.id}
                                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                                    onResizeStart={(e, h) => handleResizeStart(e, el.id, h)}
                                    onTextChange={(content) => {
                                        const newPages = [...pages];
                                        newPages[currentPageIndex].elements = newPages[currentPageIndex].elements.map(e => e.id === el.id ? { ...e, content } : e);
                                        setPages(newPages);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </main>

                <aside className="panel">
                    <div className="panel-header">الخصائص</div>
                    {selectedEl ? (
                        <div className="properties-editor">
                            {selectedEl.type === 'text' && (
                                <div className="input-group">
                                    <label className="input-label">لون النص</label>
                                    <input type="color" className="input-field" value={selectedEl.styles.color} onChange={(e) => updateStyle('color', e.target.value)} />
                                </div>
                            )}
                            {selectedEl.type === 'spatial' && (
                                <div className="input-group">
                                    <label className="input-label">نمط الخريطة (John Nelson)</label>
                                    <select className="input-field" value={selectedEl.theme} onChange={(e) => updateSpatialTheme(e.target.value)}>
                                        <option value="firefly">Firefly (متوهج)</option>
                                        <option value="vintage">Vintage (عتيق)</option>
                                        <option value="blueprint">Blueprint (مخطط)</option>
                                    </select>
                                </div>
                            )}
                            <button className="action-btn danger" onClick={() => {
                                const newPages = [...pages];
                                newPages[currentPageIndex].elements = newPages[currentPageIndex].elements.filter(e => e.id !== selectedElementId);
                                setPages(newPages);
                                setSelectedElementId(null);
                                saveState(newPages);
                            }}>حذف</button>
                        </div>
                    ) : <div style={{ opacity: 0.5, textAlign: 'center' }}>اختر عنصراً</div>}
                </aside>
            </div>

            <input type="file" ref={imageInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
            <input type="file" ref={spatialInputRef} style={{ display: 'none' }} accept=".zip,.json,.geojson" onChange={handleSpatialUpload} />
            
            {toast.show && <div className={`toast show ${toast.type}`} style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#1e1e28', padding: '12px 24px', borderRadius: 12, color: toast.type === 'success' ? '#4ade80' : '#ef4444', zIndex: 20000 }}>{toast.message}</div>}
        </div>
    );
};

const RenderedElement = ({ el, isSelected, onMouseDown, onResizeStart, onTextChange }) => {
    const style = {
        position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height,
        ...el.styles, zIndex: isSelected ? 100 : 1, userSelect: isSelected ? 'auto' : 'none'
    };

    return (
        <div className={`editable-element ${el.type}-element ${isSelected ? 'selected' : ''}`} style={style} onMouseDown={onMouseDown}>
            <MagazineElementRenderer el={el} />
            {isSelected && el.type === 'text' && (
                 <div contentEditable={isSelected} onBlur={(e) => onTextChange(e.currentTarget.innerText)} suppressContentEditableWarning={true} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }}>{el.content}</div>
            )}
            {isSelected && <div className="resize-handle se" onMouseDown={(e) => onResizeStart(e, 'se')}></div>}
        </div>
    );
};

    ];

    const renderGeometry = (geom) => {
        if (geom.type === 'Polygon') {
            return geom.coordinates.map((ring, i) => (
                <path key={i} d={`M ${ring.map(c => project(c).join(',')).join(' L ')} Z`} />
            ));
        } else if (geom.type === 'MultiPolygon') {
            return geom.coordinates.map((poly, i) => poly.map((ring, j) => (
                <path key={`${i}-${j}`} d={`M ${ring.map(c => project(c).join(',')).join(' L ')} Z`} />
            )));
        } else if (geom.type === 'LineString') {
            return <path d={`M ${geom.coordinates.map(c => project(c).join(',')).join(' L ')}`} fill="none" />;
        } else if (geom.type === 'MultiLineString') {
            return geom.coordinates.map((line, i) => (
                <path key={i} d={`M ${line.map(c => project(c).join(',')).join(' L ')}`} fill="none" />
            ));
        }
        return null;
    };

    const colors = {
        firefly: { stroke: '#d4af37', fill: 'rgba(212, 175, 55, 0.1)', glow: '#fbab15' },
        vintage: { stroke: '#5d4037', fill: 'rgba(93, 64, 55, 0.05)', glow: 'none' },
        blueprint: { stroke: '#fff', fill: 'rgba(255, 255, 255, 0.1)', glow: '#fff' }
    }[theme || 'firefly'];

    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <g 
                stroke={colors.stroke} 
                fill={colors.fill} 
                strokeWidth="1.5" 
                filter={colors.glow !== 'none' ? 'url(#glow)' : ''}
                strokeLinecap="round" strokeLinejoin="round"
            >
                {data.features ? data.features.map((f, i) => renderGeometry(f.geometry)) : renderGeometry(data)}
            </g>
        </svg>
    );
};

export default MagazineEditor;
