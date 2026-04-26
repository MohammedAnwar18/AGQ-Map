import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MagazineEditor.css';
import { magazineService, getImageUrl } from '../services/api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MagazineEditor = ({ magazineId, onClose }) => {
    // ==================== STATE MANAGEMENT ====================
    const [elements, setElements] = useState([]);
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [activePage, setActivePage] = useState('right');
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [currentResizeHandle, setCurrentResizeHandle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [magazine, setMagazine] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const leftPageRef = useRef(null);
    const rightPageRef = useRef(null);
    const imageInputRef = useRef(null);
    const bookCanvasRef = useRef(null);

    // ==================== INITIALIZATION ====================
    useEffect(() => {
        loadMagazineData();
    }, [magazineId]);

    const loadMagazineData = async () => {
        try {
            setLoading(true);
            const data = await magazineService.getMagazineById(magazineId);
            setMagazine(data.magazine);
            
            // Extract elements from pages
            // For simplicity in this editor, we assume one "spread" (2 pages) for now
            // or we could handle multiple spreads. The txt handles one spread.
            const allElements = [];
            data.pages.forEach(page => {
                const pageElements = page.content.elements || [];
                pageElements.forEach(el => {
                    allElements.push({
                        ...el,
                        page: page.page_number === 1 ? 'left' : 'right'
                    });
                });
            });
            setElements(allElements);
            
            // Initial history
            const state = JSON.stringify(allElements);
            setHistory([state]);
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

    const saveState = useCallback((newElements) => {
        const state = JSON.stringify(newElements);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(state);
        if (newHistory.length > 50) newHistory.shift();
        
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const undoAction = () => {
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            const prevState = JSON.parse(history[prevIndex]);
            setElements(prevState);
            setHistoryIndex(prevIndex);
            setSelectedElementId(null);
            showToast('تم التراجع');
        }
    };

    const redoAction = () => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            const nextState = JSON.parse(history[nextIndex]);
            setElements(nextState);
            setHistoryIndex(nextIndex);
            setSelectedElementId(null);
            showToast('تم الإعادة');
        }
    };

    // ==================== ELEMENT CREATION ====================
    const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const addTextElement = (type) => {
        const configs = {
            heading: { text: 'عنوان رئيسي', fontSize: 28, fontWeight: 'bold', fontFamily: 'Playfair Display', width: 280, height: 50 },
            subheading: { text: 'عنوان فرعي هنا', fontSize: 20, fontWeight: '600', fontFamily: 'Tajawal', width: 220, height: 35 },
            paragraph: { text: 'أضف نصك هنا... اكتب ما تريد عرضه في هذه المساحة.', fontSize: 14, fontWeight: 'normal', fontFamily: 'Tajawal', width: 260, height: 100 }
        };

        const config = configs[type];
        const newElement = {
            id: generateId(),
            type: 'text',
            page: activePage,
            content: config.text,
            x: 50,
            y: 50,
            width: config.width,
            height: config.height,
            styles: {
                fontSize: config.fontSize,
                fontWeight: config.fontWeight,
                fontFamily: config.fontFamily,
                color: '#1a1a1a',
                textAlign: 'right',
                lineHeight: 1.5,
                backgroundColor: 'transparent',
                padding: '10px'
            }
        };

        const updated = [...elements, newElement];
        setElements(updated);
        saveState(updated);
        setSelectedElementId(newElement.id);
        showToast('تمت إضافة النص');
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('image', file);
            const { url } = await magazineService.uploadImage(formData);

            const newElement = {
                id: generateId(),
                type: 'image',
                page: activePage,
                src: getImageUrl(url),
                raw_url: url,
                x: 50,
                y: 50,
                width: 250,
                height: 170,
                styles: { borderRadius: '8px', objectFit: 'cover' }
            };

            const updated = [...elements, newElement];
            setElements(updated);
            saveState(updated);
            setSelectedElementId(newElement.id);
            showToast('تمت إضافة الصورة');
        } catch (error) {
            console.error('Image upload failed:', error);
            showToast('فشل تحميل الصورة', 'danger');
        }
    };

    const addShapeElement = (shapeType) => {
        const newElement = {
            id: generateId(),
            type: 'shape',
            shapeType: shapeType,
            page: activePage,
            x: 50,
            y: 50,
            width: shapeType === 'line' ? 200 : 150,
            height: shapeType === 'line' ? 4 : 150,
            styles: {
                backgroundColor: shapeType === 'line' ? '#d4af37' : 'rgba(212, 175, 55, 0.2)',
                borderColor: '#d4af37',
                borderWidth: shapeType === 'line' ? '0' : '2px',
                borderRadius: shapeType === 'circle' ? '50%' : '8px'
            }
        };

        const updated = [...elements, newElement];
        setElements(updated);
        saveState(updated);
        setSelectedElementId(newElement.id);
    };

    // ==================== INTERACTION HANDLERS ====================
    const handleMouseDown = (e, id) => {
        if (e.target.classList.contains('resize-handle')) return;
        
        // If clicking on a text element that is already selected, don't start dragging
        // to allow text selection/editing.
        if (selectedElementId === id && e.target.getAttribute('contenteditable') === 'true') {
            return;
        }

        setSelectedElementId(id);
        setIsDragging(true);
        
        const el = elements.find(el => el.id === id);
        const page = el.page === 'left' ? leftPageRef.current : rightPageRef.current;
        const rect = page.getBoundingClientRect();
        
        setDragOffset({
            x: e.clientX - rect.left - el.x,
            y: e.clientY - rect.top - el.y
        });
    };

    const handleResizeStart = (e, id, handle) => {
        e.stopPropagation();
        setSelectedElementId(id);
        setIsResizing(true);
        setCurrentResizeHandle(handle);
    };

    const handleMouseMove = useCallback((e) => {
        if (isDragging && selectedElementId) {
            const elIndex = elements.findIndex(el => el.id === selectedElementId);
            const el = elements[elIndex];
            const page = el.page === 'left' ? leftPageRef.current : rightPageRef.current;
            const rect = page.getBoundingClientRect();
            
            const newX = e.clientX - rect.left - dragOffset.x;
            const newY = e.clientY - rect.top - dragOffset.y;
            
            const newElements = [...elements];
            newElements[elIndex] = { ...el, x: newX, y: newY };
            setElements(newElements);
        }

        if (isResizing && selectedElementId) {
            const elIndex = elements.findIndex(el => el.id === selectedElementId);
            const el = elements[elIndex];
            const page = el.page === 'left' ? leftPageRef.current : rightPageRef.current;
            const rect = page.getBoundingClientRect();
            
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const newElements = [...elements];
            const newEl = { ...el };

            const minSize = 20;

            if (currentResizeHandle === 'se') {
                newEl.width = Math.max(minSize, mouseX - el.x);
                newEl.height = Math.max(minSize, mouseY - el.y);
            } else if (currentResizeHandle === 'sw') {
                const deltaX = el.x - (mouseX);
                newEl.x = mouseX;
                newEl.width = Math.max(minSize, el.width + deltaX);
                newEl.height = Math.max(minSize, mouseY - el.y);
            } else if (currentResizeHandle === 'ne') {
                newEl.width = Math.max(minSize, mouseX - el.x);
                const deltaY = el.y - mouseY;
                newEl.y = mouseY;
                newEl.height = Math.max(minSize, el.height + deltaY);
            } else if (currentResizeHandle === 'nw') {
                const deltaX = el.x - mouseX;
                const deltaY = el.y - mouseY;
                newEl.x = mouseX;
                newEl.y = mouseY;
                newEl.width = Math.max(minSize, el.width + deltaX);
                newEl.height = Math.max(minSize, el.height + deltaY);
            }

            newElements[elIndex] = newEl;
            setElements(newElements);
        }
    }, [isDragging, isResizing, selectedElementId, elements, dragOffset, currentResizeHandle]);

    const handleMouseUp = useCallback(() => {
        if (isDragging || isResizing) {
            setIsDragging(false);
            setIsResizing(false);
            saveState(elements);
        }
    }, [isDragging, isResizing, elements, saveState]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const updateProperty = (prop, value) => {
        const newElements = elements.map(el => 
            el.id === selectedElementId ? { ...el, [prop]: value } : el
        );
        setElements(newElements);
        saveState(newElements);
    };

    const updateStyle = (styleProp, value) => {
        const newElements = elements.map(el => 
            el.id === selectedElementId ? { 
                ...el, 
                styles: { ...el.styles, [styleProp]: value } 
            } : el
        );
        setElements(newElements);
        saveState(newElements);
    };

    const togglePublish = async () => {
        try {
            const newState = !magazine.is_published;
            const updated = await magazineService.updateMagazine(magazineId, {
                title: magazine.title,
                description: magazine.description,
                is_published: newState
            });
            setMagazine(updated);
            showToast(newState ? 'تم نشر المجلة' : 'تم إلغاء النشر');
        } catch (error) {
            showToast('فشل تحديث حالة النشر', 'danger');
        }
    };

    const handleSetCover = async () => {
        if (!selectedEl || selectedEl.type !== 'image') return;
        try {
            // In a real scenario, we might want to re-upload or just send the URL
            // Our backend has a specific route for this
            // But since we already have the URL, we can just update the magazine cover field
            await magazineService.updateMagazine(magazineId, {
                ...magazine,
                cover_image: selectedEl.raw_url || selectedEl.src
            });
            showToast('تم تعيين الصورة كغلاف');
        } catch (error) {
            showToast('فشل تعيين الغلاف', 'danger');
        }
    };

    const deleteSelected = () => {
        const newElements = elements.filter(el => el.id !== selectedElementId);
        setElements(newElements);
        setSelectedElementId(null);
        saveState(newElements);
        showToast('تم حذف العنصر');
    };

    // ==================== PERSISTENCE ====================
    const saveProject = async () => {
        try {
            setLoading(true);
            // Group elements by page
            const leftElements = elements.filter(el => el.page === 'left');
            const rightElements = elements.filter(el => el.page === 'right');

            // Save Left Page (Number 1)
            await magazineService.savePage({
                magazineId,
                pageNumber: 1,
                content: { elements: leftElements }
            });

            // Save Right Page (Number 2)
            await magazineService.savePage({
                magazineId,
                pageNumber: 2,
                content: { elements: rightElements }
            });

            showToast('تم حفظ المشروع بنجاح');
        } catch (error) {
            console.error('Save failed:', error);
            showToast('فشل حفظ المشروع', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const exportPDF = async () => {
        try {
            showToast('جاري تحضير ملف PDF...');
            const canvas = await html2canvas(bookCanvasRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', [canvas.width * 0.264583, canvas.height * 0.264583]);
            pdf.addImage(imgData, 'PNG', 0, 0);
            pdf.save(`${magazine?.title || 'magazine'}.pdf`);
            showToast('تم تصدير PDF');
        } catch (error) {
            console.error('PDF export failed:', error);
            showToast('فشل تصدير PDF', 'danger');
        }
    };

    if (loading && !magazine) {
        return <div className="magazine-editor-container"><div className="spinner"></div></div>;
    }

    const selectedEl = elements.find(el => el.id === selectedElementId);

    return (
        <div className="magazine-editor-container">
            {/* Header */}
            <header className="editor-header">
                <div className="header-logo">
                    <div className="logo-badge">TI</div>
                    <span className="logo-text">محرر {magazine?.title}</span>
                </div>
                
                <div className="header-actions">
                    <button 
                        className={`header-btn ${magazine?.is_published ? 'published' : ''}`} 
                        onClick={togglePublish}
                        style={{ borderColor: magazine?.is_published ? '#4ade80' : 'var(--border-color)', color: magazine?.is_published ? '#4ade80' : 'white' }}
                    >
                        {magazine?.is_published ? '● منشور' : 'نشر'}
                    </button>
                    <button className="header-btn" onClick={undoAction}>تراجع</button>
                    <button className="header-btn" onClick={redoAction}>إعادة</button>
                    <button className="header-btn save" onClick={saveProject}>حفظ</button>
                    <button className="header-btn" onClick={exportPDF} style={{ background: '#4ade80', color: '#000' }}>تصدير PDF</button>
                    <button className="header-btn" onClick={onClose}>خروج</button>
                </div>
            </header>

            <div className="editor-layout">
                {/* Left Panel - Tools */}
                <aside className="panel">
                    <div className="panel-header">أدوات الإضافة</div>
                    <div className="tools-grid">
                        <button className="tool-btn" onClick={() => addTextElement('heading')}>عنوان</button>
                        <button className="tool-btn" onClick={() => addTextElement('subheading')}>فرعي</button>
                        <button className="tool-btn" onClick={() => addTextElement('paragraph')}>نص</button>
                        <button className="tool-btn" onClick={() => imageInputRef.current.click()}>صورة</button>
                        <button className="tool-btn" onClick={() => addShapeElement('rectangle')}>مستطيل</button>
                        <button className="tool-btn" onClick={() => addShapeElement('circle')}>دائرة</button>
                    </div>
                    
                    <div className="divider"></div>
                    <div className="panel-header">الصفحة النشطة</div>
                    <div className="page-tabs">
                        <button className={`page-tab ${activePage === 'left' ? 'active' : ''}`} onClick={() => setActivePage('left')}>اليسرى (1)</button>
                        <button className={`page-tab ${activePage === 'right' ? 'active' : ''}`} onClick={() => setActivePage('right')}>اليمنى (2)</button>
                    </div>
                </aside>

                {/* Center - Canvas */}
                <main className="canvas-area">
                    <div className="book-canvas" ref={bookCanvasRef}>
                        <div className="page-spread">
                            <div className="page-canvas left" ref={leftPageRef} onMouseDown={(e) => { if (e.target === leftPageRef.current) setSelectedElementId(null); }}>
                                {elements.filter(el => el.page === 'left').map(el => (
                                    <RenderedElement 
                                        key={el.id} 
                                        el={el} 
                                        isSelected={selectedElementId === el.id}
                                        onMouseDown={(e) => handleMouseDown(e, el.id)}
                                        onResizeStart={(e, handle) => handleResizeStart(e, el.id, handle)}
                                        onTextChange={(content) => {
                                            const updated = elements.map(e => e.id === el.id ? { ...e, content } : e);
                                            setElements(updated);
                                            saveState(updated);
                                        }}
                                    />
                                ))}
                                {elements.filter(el => el.page === 'left').length === 0 && (
                                    <div className="empty-state" style={{ pointerEvents: 'none' }}>
                                        <p>الصفحة فارغة</p>
                                    </div>
                                )}
                            </div>
                            <div className="page-spine"></div>
                            <div className="page-canvas right" ref={rightPageRef} onMouseDown={(e) => { if (e.target === rightPageRef.current) setSelectedElementId(null); }}>
                                {elements.filter(el => el.page === 'right').map(el => (
                                    <RenderedElement 
                                        key={el.id} 
                                        el={el} 
                                        isSelected={selectedElementId === el.id}
                                        onMouseDown={(e) => handleMouseDown(e, el.id)}
                                        onResizeStart={(e, handle) => handleResizeStart(e, el.id, handle)}
                                        onTextChange={(content) => {
                                            const updated = elements.map(e => e.id === el.id ? { ...e, content } : e);
                                            setElements(updated);
                                            saveState(updated);
                                        }}
                                    />
                                ))}
                                {elements.filter(el => el.page === 'right').length === 0 && (
                                    <div className="empty-state" style={{ pointerEvents: 'none' }}>
                                        <p>الصفحة فارغة</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                {/* Right Panel - Properties */}
                <aside className="panel">
                    <div className="panel-header">الخصائص</div>
                    {selectedEl ? (
                        <div className="properties-editor">
                            <div className="input-group">
                                <label className="input-label">العرض</label>
                                <input type="number" className="input-field" value={Math.round(selectedEl.width)} onChange={(e) => updateProperty('width', parseInt(e.target.value))} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">الارتفاع</label>
                                <input type="number" className="input-field" value={Math.round(selectedEl.height)} onChange={(e) => updateProperty('height', parseInt(e.target.value))} />
                            </div>

                            {selectedEl.type === 'text' && (
                                <>
                                    <div className="input-group">
                                        <label className="input-label">حجم الخط</label>
                                        <input type="range" className="range-slider" min="10" max="100" value={selectedEl.styles.fontSize} onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">اللون</label>
                                        <input type="color" className="input-field" value={selectedEl.styles.color} onChange={(e) => updateStyle('color', e.target.value)} />
                                    </div>
                                </>
                            )}

                            {selectedEl.type === 'image' && (
                                <button className="action-btn secondary" onClick={handleSetCover} style={{ marginBottom: '10px' }}>
                                    تعيين كغلاف للمجلة
                                </button>
                            )}
                            
                            {(selectedEl.type === 'shape' || selectedEl.type === 'text') && (
                                <div className="input-group">
                                    <label className="input-label">خلفية</label>
                                    <input type="color" className="input-field" value={selectedEl.styles.backgroundColor} onChange={(e) => updateStyle('backgroundColor', e.target.value)} />
                                </div>
                            )}

                            <button className="action-btn danger" onClick={deleteSelected}>حذف العنصر</button>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', opacity: 0.5 }}>اختر عنصر لتعديله</div>
                    )}

                    <div className="divider"></div>
                    <div className="panel-header">الطبقات</div>
                    <div className="layers-list">
                        {elements.map((el, i) => (
                            <div key={el.id} className={`layer-item ${selectedElementId === el.id ? 'active' : ''}`} onClick={() => setSelectedElementId(el.id)}>
                                {el.type} {i + 1}
                            </div>
                        ))}
                    </div>
                </aside>
            </div>

            {/* Hidden Input */}
            <input type="file" ref={imageInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />

            {/* Toast */}
            {toast.show && (
                <div className={`toast show ${toast.type}`} style={{ 
                    position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                    background: '#1e1e28', border: `1px solid ${toast.type === 'success' ? '#4ade80' : '#ef4444'}`,
                    padding: '12px 24px', borderRadius: 12, color: toast.type === 'success' ? '#4ade80' : '#ef4444'
                }}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

const RenderedElement = ({ el, isSelected, onMouseDown, onResizeStart, onTextChange }) => {
    const style = {
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        ...el.styles,
        fontSize: el.type === 'text' ? `${el.styles.fontSize}px` : undefined,
        zIndex: isSelected ? 100 : 1
    };

    const handleInput = (e) => {
        onTextChange(e.currentTarget.innerText);
    };

    return (
        <div 
            className={`editable-element ${el.type}-element ${isSelected ? 'selected' : ''}`}
            style={style}
            onMouseDown={onMouseDown}
        >
            {el.type === 'text' ? (
                <div 
                    contentEditable={isSelected} 
                    onBlur={handleInput}
                    suppressContentEditableWarning={true}
                    style={{ width: '100%', height: '100%' }}
                >
                    {el.content}
                </div>
            ) : el.type === 'image' ? (
                <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : el.type === 'shape' ? (
                <div style={{ width: '100%', height: '100%', background: el.styles.backgroundColor, border: el.styles.borderWidth + ' solid ' + el.styles.borderColor, borderRadius: el.styles.borderRadius }}></div>
            ) : null}

            {isSelected && (
                <>
                    <div className="resize-handle nw" onMouseDown={(e) => onResizeStart(e, 'nw')}></div>
                    <div className="resize-handle ne" onMouseDown={(e) => onResizeStart(e, 'ne')}></div>
                    <div className="resize-handle sw" onMouseDown={(e) => onResizeStart(e, 'sw')}></div>
                    <div className="resize-handle se" onMouseDown={(e) => onResizeStart(e, 'se')}></div>
                </>
            )}
        </div>
    );
};

export default MagazineEditor;
