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
            const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`shopping-list-${Date.now()}.pdf`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("حدث خطأ أثناء طباعة القائمة.");
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal-container"
                style={{ width: '90%', maxWidth: '500px', height: 'auto', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>🛒 سلة المشتريات</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {cart.items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                            <p>السلة فارغة حالياً</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                            {cart.items.map(item => (
                                <div key={item.id} style={{ display: 'flex', gap: 10, background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                                    {item.image_url ? (
                                        <img src={item.image_url.startsWith('http') ? item.image_url : `${import.meta.env.VITE_API_URL.replace('/api', '')}${item.image_url}`} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
                                    ) : (
                                        <div style={{ width: 60, height: 60, background: '#e5e7eb', borderRadius: 4 }}></div>
                                    )}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <h4 style={{ margin: '0 0 2px', fontSize: '1rem' }}>{item.name}</h4>
                                        {item.note && (
                                            <div style={{ fontSize: '0.85rem', color: '#d97706', background: '#fffbeb', padding: '2px 6px', borderRadius: 4, marginBottom: 4, display: 'inline-block', border: '1px solid #fcd34d' }}>
                                                📝 {item.note}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            من: {item.shop_name || item.shop?.name || 'غير معروف'}
                                        </div>
                                        <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{item.price} شيكل</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                        <button onClick={() => handleRemove(item.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }}>✕</button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '2px' }}>
                                            <button onClick={() => handleQuantity(item.id, -1)} style={{ width: 24, height: 24, border: 'none', background: 'white', borderRadius: 4, cursor: 'pointer' }}>-</button>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{item.quantity}</span>
                                            <button onClick={() => handleQuantity(item.id, 1)} style={{ width: 24, height: 24, border: 'none', background: 'white', borderRadius: 4, cursor: 'pointer' }}>+</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid var(--borderColor)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, fontSize: '1.2rem', fontWeight: 'bold' }}>
                        <span>المجموع الكلي:</span>
                        <span style={{ color: 'var(--primary)' }}>{total.toFixed(2)} شيكل</span>
                    </div>
                    <button
                        className="btn is-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                        disabled={cart.items.length === 0}
                        onClick={handlePrintPDF}
                    >
                        <span>🖨️</span> طباعة القائمة
                    </button>
                </div>

                {/* Hidden Print Receipt Template */}
                <div style={{ position: 'absolute', top: -10000, left: -10000 }}>
                    <div ref={printRef} style={{ width: '210mm', padding: '20mm', background: 'white', color: '#000000', fontFamily: 'Arial, sans-serif', direction: 'rtl', boxSizing: 'border-box' }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #fbab15', paddingBottom: '10px' }}>
                            <h1 style={{ margin: 0, color: '#000000', fontSize: '24px' }}>قائمة المشتريات</h1>
                            <p style={{ margin: '5px 0', color: '#000000' }}>تاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '14px', color: '#000000' }}>
                            <thead>
                                <tr style={{ background: '#fbab15', color: 'white' }}>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>المنتج</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>المتجر</th>
                                    <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>الكمية</th>
                                    <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>السعر</th>
                                    <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>الاجمالي</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: '#000000' }}>
                                {cart.items.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '10px', border: '1px solid #eee', color: '#000000' }}>
                                            {item.name}
                                            {item.note && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>ملاحظة: {item.note}</div>}
                                        </td>
                                        <td style={{ padding: '10px', border: '1px solid #eee', color: '#000000' }}>{item.shop_name || "غير معروف"}</td>
                                        <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #eee', color: '#000000' }}>{item.quantity}</td>
                                        <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #eee', color: '#000000' }}>{item.price}</td>
                                        <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #eee', color: '#000000' }}>{(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ textAlign: 'left', marginTop: '20px', fontSize: '1.2rem', fontWeight: 'bold', borderTop: '2px solid #fbab15', paddingTop: '10px', color: '#000000' }}>
                            المجموع الكلي: <span style={{ color: '#fbab15' }}>{total.toFixed(2)} شيكل</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartModal;
