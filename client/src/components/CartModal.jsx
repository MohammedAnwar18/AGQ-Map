import React, { useState, useEffect, useRef } from 'react';
import { cartService } from '../services/cartService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './Modal.css';

const CartModal = ({ onClose }) => {
    const [cart, setCart] = useState(cartService.getCart());
    const [total, setTotal] = useState(0);
    const printRef = useRef(null);

    const refreshCart = () => {
        setCart(cartService.getCart());
        setTotal(cartService.getTotalPrice());
    };

    useEffect(() => {
        refreshCart();
        const handleUpdate = () => refreshCart();
        window.addEventListener('cart-updated', handleUpdate);
        return () => window.removeEventListener('cart-updated', handleUpdate);
    }, []);

    const handleQuantity = (id, delta) => {
        cartService.updateQuantity(id, delta);
    };

    const handleRemove = (id) => {
        cartService.removeItem(id);
    };

    const handlePrintPDF = async () => {
        if (!printRef.current) return;
        try {
            // High fidelity capture with specific configuration for Arabic and fonts
            const canvas = await html2canvas(printRef.current, { 
                scale: 3, // Higher scale for professional print quality
                useCORS: true, 
                logging: false, 
                backgroundColor: '#ffffff',
                windowWidth: 1200 // Ensure desktop-like layout for capture
            });
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdf = new jsPDF({ 
                orientation: 'portrait', 
                unit: 'mm', 
                format: 'a4',
                compress: true
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // Add image with top padding if needed, or fill page
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            
            // Generate a professional filename
            const dateStr = new Date().toISOString().split('T')[0];
            pdf.save(`PalNovaa-Order-${dateStr}.pdf`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("حدث خطأ أثناء تحميل الملف. يرجى المحاولة لاحقاً.");
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal-container"
                style={{ 
                    width: '95%', 
                    maxWidth: '480px', 
                    maxHeight: '85vh', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '15px 20px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        سلة المشتريات
                    </h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#f8fafc' }}>
                    {cart.items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '15px', opacity: 0.3 }}>🛒</div>
                            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>سلتك فارغة حالياً</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {cart.items.map(item => (
                                <div key={item.id} style={{ 
                                    display: 'flex', 
                                    gap: 12, 
                                    background: 'white', 
                                    padding: '12px', 
                                    borderRadius: '16px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                    border: '1px solid rgba(0,0,0,0.03)'
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        {item.image_url ? (
                                            <img 
                                                src={item.image_url.startsWith('http') ? item.image_url : `${import.meta.env.VITE_API_URL.replace('/api', '')}${item.image_url}`} 
                                                style={{ width: 75, height: 75, objectFit: 'cover', borderRadius: '12px' }} 
                                            />
                                        ) : (
                                            <div style={{ width: 75, height: 75, background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📦</div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>{item.name}</h4>
                                            <button onClick={() => handleRemove(item.id)} style={{ color: '#ef4444', background: '#fee2e2', border: 'none', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                        </div>
                                        
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            {item.shop_name || 'متجر'}
                                        </div>

                                        {item.note && (
                                            <div style={{ fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fef3c7', alignSelf: 'flex-start' }}>
                                                📝 {item.note}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                            <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1rem' }}>{item.price} <small>ILS</small></div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f1f5f9', borderRadius: '50px', padding: '2px 4px' }}>
                                                <button onClick={() => handleQuantity(item.id, -1)} style={{ width: 26, height: 26, border: 'none', background: 'white', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#1e293b' }}>-</button>
                                                <span style={{ fontSize: '0.9rem', fontWeight: '800', minWidth: '15px', textAlign: 'center', color: '#1e293b' }}>{item.quantity}</span>
                                                <button onClick={() => handleQuantity(item.id, 1)} style={{ width: 26, height: 26, border: 'none', background: 'white', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#1e293b' }}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ background: 'white', padding: '20px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>المجموع الكلي:</span>
                        <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>{total.toFixed(2)}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#64748b', marginRight: '5px' }}>شيكل</span>
                        </div>
                    </div>
                    
                    <button
                        className="btn is-primary"
                        style={{ 
                            width: '100%', 
                            height: '52px',
                            background: '#fbab15', 
                            color: 'white',
                            borderRadius: '16px',
                            fontSize: '1.1rem',
                            fontWeight: '800',
                            letterSpacing: '0.5px',
                            boxShadow: '0 10px 20px -5px rgba(251, 171, 21, 0.4)',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                        disabled={cart.items.length === 0}
                        onClick={handlePrintPDF}
                    >
                        تحميل قائمة المشتريات (PDF)
                    </button>
                </div>

                {/* --- PROFESSIONAL INVOICE TEMPLATE FOR PDF --- */}
                <div style={{ position: 'absolute', top: -20000, left: -20000 }}>
                    <div ref={printRef} style={{ 
                        width: '210mm', 
                        padding: '25mm', 
                        background: 'white', 
                        color: '#1e293b', 
                        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 
                        direction: 'rtl', 
                        boxSizing: 'border-box' 
                    }}>
                        {/* Header Section */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '4px solid #fbab15', paddingBottom: '20px' }}>
                            <div>
                                <h1 style={{ margin: 0, color: '#0f172a', fontSize: '32px', fontWeight: '900' }}>PalNovaa</h1>
                                <p style={{ margin: '5px 0', color: '#64748b', fontSize: '16px' }}>الشبكة الاجتماعية المكانية - فلسطين</p>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <h2 style={{ margin: 0, color: '#fbab15', fontSize: '24px' }}>قائمة طلبات</h2>
                                <p style={{ margin: '5px 0', color: '#64748b' }}>{new Date().toLocaleDateString('ar-PS')}</p>
                            </div>
                        </div>

                        {/* Order Info */}
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ margin: '0 0 5px', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase' }}>حالة السلة</p>
                                <p style={{ margin: 0, fontWeight: 'bold' }}>جاهزة للتسوق</p>
                            </div>
                            <div>
                                <p style={{ margin: '0 0 5px', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase' }}>عدد الأصناف</p>
                                <p style={{ margin: 0, fontWeight: 'bold' }}>{cart.items.length} أصناف</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                            <thead>
                                <tr style={{ background: '#0f172a', color: 'white' }}>
                                    <th style={{ padding: '15px', textAlign: 'right', borderRadius: '0 8px 0 0' }}>المنتج والتفاصيل</th>
                                    <th style={{ padding: '15px', textAlign: 'center' }}>المتجر</th>
                                    <th style={{ padding: '15px', textAlign: 'center' }}>الكمية</th>
                                    <th style={{ padding: '15px', textAlign: 'center' }}>سعر الوحدة</th>
                                    <th style={{ padding: '15px', textAlign: 'center', borderRadius: '8px 0 0 0' }}>الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.items.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '20px 15px' }}>
                                            <div style={{ fontWeight: '800', fontSize: '16px', color: '#1e293b' }}>{item.name}</div>
                                            {item.note && <div style={{ fontSize: '13px', color: '#f59e0b', marginTop: '4px', background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>ملاحظة: {item.note}</div>}
                                        </td>
                                        <td style={{ padding: '20px 15px', textAlign: 'center', color: '#64748b' }}>{item.shop_name || "متجر عام"}</td>
                                        <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                                        <td style={{ padding: '20px 15px', textAlign: 'center' }}>{item.price}</td>
                                        <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: '800', color: '#0f172a' }}>{(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Summary Section */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '200px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', color: '#64748b' }}>
                                    <span>المجموع الفرعي:</span>
                                    <span>{total.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderTop: '2px solid #0f172a', marginTop: '10px' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '900' }}>المجموع الكلي:</span>
                                    <span style={{ fontSize: '22px', fontWeight: '900', color: '#fbab15' }}>{total.toFixed(2)} شيكل</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ marginTop: '60px', textAlign: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '30px' }}>
                            <p style={{ color: '#94a3b8', fontSize: '12px' }}>شكراً لتسوقكم عبر PalNovaa. هذا الملف تم إنتاجه تلقائياً ولا يعتبر فاتورة قانونية للبيع.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartModal;
