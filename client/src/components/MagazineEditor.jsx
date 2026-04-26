import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MagazineEditor.css';
import { magazineService, getImageUrl } from '../services/api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MagazineEditor = ({ magazineId, onClose }) => {
    // ==================== STATE MANAGEMENT ====================
    const [pages, setPages] = useState([{ page_number: 1, elements: [] }]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0); // 0-indexed for state
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
    const editorLayoutRef = useRef(null);

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
            
            // Initial history
            const state = JSON.stringify(data.pages);
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
            const prevState = JSON.parse(history[prevIndex]);
            setPages(prevState);
            setHistoryIndex(prevIndex);
            setSelectedElementId(null);
            showToast('تم التراجع');
        }
    };

    const redoAction = () => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            const nextState = JSON.parse(history[nextIndex]);
            setPages(nextState);
            setHistoryIndex(nextIndex);
            setSelectedElementId(null);
            showToast('تم الإعادة');
        }
    };

    // ==================== PAGE MANAGEMENT ====================
    const addPage = () => {
        const newPageNum = pages.length + 1;
        const newPages = [...pages, { page_number: newPageNum, elements: [] }];
        setPages(newPages);
        setCurrentPageIndex(newPages.length - 1);
        saveState(newPages);
        showToast('تمت إضافة صفحة جديدة');
    };

    const deleteCurrentPage = () => {
        if (pages.length <= 1) {
            showToast('لا يمكن حذف آخر صفحة', 'danger');
            return;
        }
        if (!window.confirm('هل أنت متأكد من حذف هذه الصفحة؟')) return;

        const newPages = pages.filter((_, i) => i !== currentPageIndex)
            .map((p, i) => ({ ...p, page_number: i + 1 }));
        
        setPages(newPages);
        setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
        saveState(newPages);
        showToast('تم حذف الصفحة');
    };

    // ==================== ELEMENT CREATION ====================
    const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const addElement = (elementData) => {
        const newPages = [...pages];
        const currentElements = newPages[currentPageIndex].elements;
        
        const newElement = {
            id: generateId(),
            x: 50,
            y: 50,
            width: 200,
            height: 100,
            ...elementData
        };

        newPages[currentPageIndex].elements = [...currentElements, newElement];
        setPages(newPages);
        saveState(newPages);
        setSelectedElementId(newElement.id);
    };

    const addTextElement = (type) => {
        const configs = {
            heading: { text: 'عنوان رئيسي', fontSize: 28, fontWeight: 'bold', fontFamily: 'Playfair Display', width: 280, height: 50 },
            subheading: { text: 'عنوان فرعي هنا', fontSize: 20, fontWeight: '600', fontFamily: 'Tajawal', width: 220, height: 35 },
            paragraph: { text: 'أضف نصك هنا...', fontSize: 14, fontWeight: 'normal', fontFamily: 'Tajawal', width: 260, height: 100 }
        };

        const config = configs[type];
        addElement({
            type: 'text',
            content: config.text,
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
        });
        showToast('تمت إضافة النص');
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('image', file);
            const { url } = await magazineService.uploadImage(formData);

            addElement({
                type: 'image',
                src: getImageUrl(url),
                raw_url: url,
                width: 250,
                height: 170,
                styles: { borderRadius: '8px', objectFit: 'cover' }
            });
            showToast('تمت إضافة الصورة');
        } catch (error) {
            console.error('Image upload failed:', error);
            showToast('فشل تحميل الصورة', 'danger');
        }
    };

    const addShapeElement = (shapeType) => {
        addElement({
            type: 'shape',
            shapeType: shapeType,
            width: shapeType === 'line' ? 200 : 150,
            height: shapeType === 'line' ? 4 : 150,
            styles: {
                backgroundColor: shapeType === 'line' ? '#d4af37' : 'rgba(212, 175, 55, 0.2)',
                borderColor: '#d4af37',
                borderWidth: shapeType === 'line' ? '0' : '2px',
                borderRadius: shapeType === 'circle' ? '50%' : '8px'
            }
        });
    };

    // ==================== INTERACTION HANDLERS ====================
    const handleMouseDown = (e, id) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (selectedElementId === id && e.target.getAttribute('contenteditable') === 'true') return;

        setSelectedElementId(id);
        setIsDragging(true);
        
        const el = pages[currentPageIndex].elements.find(el => el.id === id);
        const rect = pageCanvasRef.current.getBoundingClientRect();
        
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
        if (!selectedElementId) return;

        if (isDragging) {
            const newPages = [...pages];
            const elIndex = newPages[currentPageIndex].elements.findIndex(el => el.id === selectedElementId);
            const el = newPages[currentPageIndex].elements[elIndex];
            const rect = pageCanvasRef.current.getBoundingClientRect();
            
            const newX = e.clientX - rect.left - dragOffset.x;
            const newY = e.clientY - rect.top - dragOffset.y;
            
            newPages[currentPageIndex].elements[elIndex] = { ...el, x: newX, y: newY };
            setPages(newPages);
        }

        if (isResizing) {
            const newPages = [...pages];
            const elIndex = newPages[currentPageIndex].elements.findIndex(el => el.id === selectedElementId);
            const el = newPages[currentPageIndex].elements[elIndex];
            const rect = pageCanvasRef.current.getBoundingClientRect();
            
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const newEl = { ...el };
            const minSize = 20;

            if (currentResizeHandle === 'se') {
                newEl.width = Math.max(minSize, mouseX - el.x);
                newEl.height = Math.max(minSize, mouseY - el.y);
            } else if (currentResizeHandle === 'sw') {
                const deltaX = el.x - mouseX;
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

            newPages[currentPageIndex].elements[elIndex] = newEl;
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

    const updateProperty = (prop, value) => {
        const newPages = [...pages];
        newPages[currentPageIndex].elements = newPages[currentPageIndex].elements.map(el => 
            el.id === selectedElementId ? { ...el, [prop]: value } : el
        );
        setPages(newPages);
        saveState(newPages);
    };

    const updateStyle = (styleProp, value) => {
        const newPages = [...pages];
        newPages[currentPageIndex].elements = newPages[currentPageIndex].elements.map(el => 
            el.id === selectedElementId ? { 
                ...el, 
                styles: { ...el.styles, [styleProp]: value } 
            } : el
        );
        setPages(newPages);
        saveState(newPages);
    };

    const deleteSelected = () => {
        const newPages = [...pages];
        newPages[currentPageIndex].elements = newPages[currentPageIndex].elements.filter(el => el.id !== selectedElementId);
        setPages(newPages);
        setSelectedElementId(null);
        saveState(newPages);
        showToast('تم حذف العنصر');
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
        const el = pages[currentPageIndex].elements.find(e => e.id === selectedElementId);
        if (!el || el.type !== 'image') return;
        try {
            await magazineService.updateMagazine(magazineId, {
                ...magazine,
                cover_image: el.raw_url || el.src
            });
            showToast('تم تعيين الصورة كغلاف');
        } catch (error) {
            showToast('فشل تعيين الغلاف', 'danger');
        }
    };

    // ==================== PERSISTENCE ====================
    const saveProject = async () => {
        try {
            setLoading(true);
            for (const page of pages) {
                await magazineService.savePage({
                    magazineId,
                    pageNumber: page.page_number,
                    content: { elements: page.elements }
                });
            }
            showToast('تم حفظ جميع الصفحات بنجاح');
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
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            for (let i = 0; i < pages.length; i++) {
                setCurrentPageIndex(i);
                // Wait for state to update and render
                await new Promise(r => setTimeout(r, 500));
                
                const canvas = await html2canvas(pageCanvasRef.current, {
                    useCORS: true,
                    scale: 2,
                    backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
            }
            
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

    const currentPage = pages[currentPageIndex];
    const selectedEl = currentPage.elements.find(el => el.id === selectedElementId);

    return (
        <div className="magazine-editor-container">
            <header className="editor-header">
                <div className="header-logo">
                    <div className="logo-badge">TI</div>
                    <span className="logo-text">محرر {magazine?.title}</span>
                </div>
                
                <div className="header-actions">
                    <button className={`header-btn ${magazine?.is_published ? 'published' : ''}`} onClick={togglePublish}
                        style={{ borderColor: magazine?.is_published ? '#4ade80' : 'var(--border-color)', color: magazine?.is_published ? '#4ade80' : 'white' }}>
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
                    <div className="panel-header">الصفحات ({pages.length})</div>
                    <div className="page-tabs">
                        {pages.map((p, i) => (
                            <button key={i} className={`page-tab ${currentPageIndex === i ? 'active' : ''}`} onClick={() => { setCurrentPageIndex(i); setSelectedElementId(null); }}>
                                {p.page_number}
                            </button>
                        ))}
                        <button className="page-tab" onClick={addPage} style={{ background: 'var(--accent)', color: '#000' }}>+</button>
                    </div>
                    <button className="action-btn danger" onClick={deleteCurrentPage} style={{ fontSize: '12px', padding: '8px' }}>حذف الصفحة الحالية</button>
                </aside>

                <main className="canvas-area">
                    <div className="book-canvas" style={{ width: isMobile ? '90%' : '500px', minHeight: isMobile ? '550px' : '700px', flexDirection: 'column' }}>
                        <div className="page-canvas" ref={pageCanvasRef} onMouseDown={(e) => { if (e.target === pageCanvasRef.current) setSelectedElementId(null); }} style={{ width: '100%', height: '100%' }}>
                            {currentPage.elements.map(el => (
                                <RenderedElement 
                                    key={el.id} 
                                    el={el} 
                                    isSelected={selectedElementId === el.id}
                                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                                    onResizeStart={(e, handle) => handleResizeStart(e, el.id, handle)}
                                    onTextChange={(content) => {
                                        const newPages = [...pages];
                                        newPages[currentPageIndex].elements = newPages[currentPageIndex].elements.map(e => e.id === el.id ? { ...e, content } : e);
                                        setPages(newPages);
                                        saveState(newPages);
                                    }}
                                />
                            ))}
                            {currentPage.elements.length === 0 && (
                                <div className="empty-state" style={{ pointerEvents: 'none' }}>
                                    <p>الصفحة {currentPage.page_number} فارغة</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

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
                                <button className="action-btn secondary" onClick={handleSetCover} style={{ marginBottom: '10px' }}>تعيين كغلاف</button>
                            )}

                            <button className="action-btn danger" onClick={deleteSelected}>حذف العنصر</button>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', opacity: 0.5 }}>اختر عنصر لتعديله</div>
                    )}

                    <div className="divider"></div>
                    <div className="panel-header">طبقات الصفحة {currentPage.page_number}</div>
                    <div className="layers-list">
                        {currentPage.elements.map((el, i) => (
                            <div key={el.id} className={`layer-item ${selectedElementId === el.id ? 'active' : ''}`} onClick={() => setSelectedElementId(el.id)}>
                                {el.type} {i + 1}
                            </div>
                        ))}
                    </div>
                </aside>
            </div>

            <input type="file" ref={imageInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
            {toast.show && (
                <div className={`toast show ${toast.type}`} style={{ 
                    position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                    background: '#1e1e28', border: `1px solid ${toast.type === 'success' ? '#4ade80' : '#ef4444'}`,
                    padding: '12px 24px', borderRadius: 12, color: toast.type === 'success' ? '#4ade80' : '#ef4444',
                    zIndex: 11000
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
        zIndex: isSelected ? 100 : 1,
        userSelect: isSelected ? 'auto' : 'none'
    };

    const handleInput = (e) => onTextChange(e.currentTarget.innerText);

    return (
        <div className={`editable-element ${el.type}-element ${isSelected ? 'selected' : ''}`} style={style} onMouseDown={onMouseDown}>
            {el.type === 'text' ? (
                <div contentEditable={isSelected} onBlur={handleInput} suppressContentEditableWarning={true} style={{ width: '100%', height: '100%' }}>
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
