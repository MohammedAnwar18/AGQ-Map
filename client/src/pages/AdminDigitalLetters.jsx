import React, { useState, useEffect } from 'react';
import { digitalLettersService } from '../services/api';
import './AdminDashboard.css'; // Leverage existing dashboard styles

const AdminDigitalLetters = () => {
    const [letters, setLetters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingLetter, setEditingLetter] = useState(null);

    // Form states
    const [title, setTitle] = useState('');
    const [senderName, setSenderName] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [content, setContent] = useState('');
    const [envelopeColor, setEnvelopeColor] = useState('maroon');
    const [sealDesign, setSealDesign] = useState('wax-classic');
    const [slug, setSlug] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [musicFile, setMusicFile] = useState(null);
    const [musicUrl, setMusicUrl] = useState('');
    
    // Preview URLs
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        loadLetters();
    }, []);

    const loadLetters = async () => {
        try {
            setLoading(true);
            const res = await digitalLettersService.getAll();
            if (res && res.success) {
                setLetters(res.letters);
            }
        } catch (err) {
            console.error('Failed to load digital letters:', err);
            alert('❌ حدث خطأ أثناء تحميل الرسائل الرقمية');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingLetter(null);
        setTitle('');
        setSenderName('');
        setRecipientName('');
        setContent('');
        setEnvelopeColor('maroon');
        setSealDesign('wax-classic');
        setSlug('');
        setImageFile(null);
        setImagePreview(null);
        setMusicFile(null);
        setMusicUrl('');
        setShowModal(true);
    };

    const handleOpenEdit = (letter) => {
        setEditingLetter(letter);
        setTitle(letter.title || '');
        setSenderName(letter.sender_name || '');
        setRecipientName(letter.recipient_name || '');
        setContent(letter.content || '');
        setEnvelopeColor(letter.envelope_color || 'maroon');
        setSealDesign(letter.seal_design || 'wax-classic');
        setSlug(letter.slug || '');
        setImageFile(null);
        setImagePreview(letter.image_url || null);
        setMusicFile(null);
        setMusicUrl(letter.music_url || '');
        setShowModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleMusicChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setMusicFile(file);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه الدعوة/الرسالة نهائياً؟')) return;
        try {
            const res = await digitalLettersService.delete(id);
            if (res && res.success) {
                alert('🗑️ تم حذف الرسالة بنجاح!');
                loadLetters();
            }
        } catch (err) {
            console.error('Failed to delete letter:', err);
            alert('❌ فشل حذف الرسالة.');
        }
    };

    const handleCopyLink = (slug) => {
        const url = `${window.location.origin}/l/${slug}`;
        navigator.clipboard.writeText(url)
            .then(() => alert('📋 تم نسخ رابط الدعوة الرقمية بنجاح!'))
            .catch(() => alert('❌ فشل نسخ الرابط'));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('sender_name', senderName);
            formData.append('recipient_name', recipientName);
            formData.append('content', content);
            formData.append('envelope_color', envelopeColor);
            formData.append('seal_design', sealDesign);
            formData.append('slug', slug);
            
            if (imageFile) {
                formData.append('image', imageFile);
            }
            if (musicFile) {
                formData.append('music', musicFile);
            } else if (musicUrl) {
                formData.append('music_url', musicUrl);
            }

            let res;
            if (editingLetter) {
                res = await digitalLettersService.update(editingLetter.id, formData);
            } else {
                res = await digitalLettersService.create(formData);
            }

            if (res && res.success) {
                alert(editingLetter ? '💾 تم تعديل الرسالة بنجاح!' : '🎉 تم إنشاء الرسالة الرقمية بنجاح!');
                setShowModal(false);
                loadLetters();
            }
        } catch (err) {
            console.error('Failed to save digital letter:', err);
            alert(err.response?.data?.error || '❌ حدث خطأ أثناء الحفظ.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="admin-content-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: 'var(--accent)', fontSize: '1.6rem' }}>إدارة الأظرف والدعوات الرقمية 3D</h3>
                <button 
                    onClick={handleOpenCreate}
                    style={{ 
                        padding: '10px 20px', 
                        backgroundColor: 'var(--accent)', 
                        color: '#000', 
                        border: 'none', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        fontWeight: 'bold' 
                    }}
                >
                    ✉️ إنشاء دعوة/ظرف جديد
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
                    <div className="spinner"></div>
                </div>
            ) : letters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', opacity: 0.6 }}>
                    <p>لم يتم إنشاء أي دعوات أو أظرف رقمية بعد.</p>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>اسم الدعوة (العنوان)</th>
                                <th>المرسل</th>
                                <th>المستقبل</th>
                                <th>الرابط الخاص (Slug)</th>
                                <th>تاريخ الإنشاء</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {letters.map((letter) => (
                                <tr key={letter.id}>
                                    <td style={{ fontWeight: 'bold' }}>{letter.title}</td>
                                    <td>{letter.sender_name || '-'}</td>
                                    <td>{letter.recipient_name || '-'}</td>
                                    <td>
                                        <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>/l/{letter.slug}</span>
                                    </td>
                                    <td>{new Date(letter.created_at).toLocaleDateString('ar-SA')}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                className="btn-action" 
                                                onClick={() => handleCopyLink(letter.slug)}
                                                style={{ backgroundColor: 'rgba(251, 171, 21, 0.15)', color: 'var(--accent)' }}
                                            >
                                                📋 نسخ الرابط
                                            </button>
                                            <button 
                                                className="btn-action" 
                                                onClick={() => handleOpenEdit(letter)}
                                                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                                            >
                                                ✏️ تعديل
                                            </button>
                                            <button 
                                                className="btn-action" 
                                                onClick={() => handleDelete(letter.id)}
                                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
                                            >
                                                🗑️ حذف
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-backdrop" style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        backgroundColor: '#0f172a', border: '1px solid var(--glass-border)',
                        borderRadius: '16px', padding: '30px', width: '600px', maxWidth: '90%',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)', overflowY: 'auto', maxHeight: '85vh'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ color: 'var(--accent)', marginBottom: '20px', textAlign: 'center', fontSize: '1.5rem' }}>
                            {editingLetter ? '✏️ تعديل الدعوة الرقمية' : '✉️ إنشاء دعوة/ظرف رقمي جديد'}
                        </h3>
                        
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>عنوان الدعوة الرئيسي (مثال: دعوة زفاف، تهنئة تخرج)*</label>
                                <input 
                                    type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                                    placeholder="ادخل العنوان هنا..."
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>اسم المرسل (من)*</label>
                                    <input 
                                        type="text" required value={senderName} onChange={(e) => setSenderName(e.target.value)}
                                        placeholder="مثال: عائلة أبو أحمد"
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>اسم المدعو (اختياري)</label>
                                    <input 
                                        type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                                        placeholder="مثال: السيد محمد المحترم"
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>رابط مخصص (Slug) - اختياري</label>
                                <input 
                                    type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
                                    placeholder="مثال: my-wedding (سيصبح الرابط: palnovaa.com/l/my-wedding)"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>نص الرسالة / الدعوة بالتفصيل</label>
                                <textarea 
                                    rows="5" value={content} onChange={(e) => setContent(e.target.value)}
                                    placeholder="تفاصيل الحفل، التاريخ، الموقع والعبارات الترحيبية..."
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>لون الظرف الخارجي</label>
                                    <select 
                                        value={envelopeColor} onChange={(e) => setEnvelopeColor(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                    >
                                        <option value="maroon">🔴 أحمر داكن (Maroon)</option>
                                        <option value="navy">🔵 أزرق ملكي (Navy)</option>
                                        <option value="forest-green">🟢 أخضر زمردي (Emerald Green)</option>
                                        <option value="warm-cream">🟡 بيج دافئ (Warm Cream)</option>
                                        <option value="royal-gold">🟠 ذهبي ملكي (Royal Gold)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>شكل الختم الشمعي</label>
                                    <select 
                                        value={sealDesign} onChange={(e) => setSealDesign(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                    >
                                        <option value="wax-classic">✉️ كلاسيكي (رسالة)</option>
                                        <option value="heart-wax">❤️ حب (قلب)</option>
                                        <option value="rose-wax">🌹 رومانسي (وردة)</option>
                                        <option value="star-wax">⭐ تميز (نجمة)</option>
                                        <option value="crown-wax">👑 ملكي (تاج)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>صورة بطاقة الدعوة (تظهر بداخل الظرف)</label>
                                <input 
                                    type="file" accept="image/*" onChange={handleImageChange}
                                    style={{ width: '100%', color: '#94a3b8' }}
                                />
                                {imagePreview && (
                                    <div style={{ marginTop: '10px', position: 'relative' }}>
                                        <img 
                                            src={imagePreview.startsWith('blob:') ? imagePreview : `${window.location.origin}${imagePreview}`} 
                                            alt="Preview" 
                                            style={{ maxHeight: '150px', borderRadius: '8px', border: '1px solid var(--glass-border)' }} 
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>صوت/موسيقى الخلفية (يتم تشغيلها تلقائياً عند فتح الظرف)</label>
                                <input 
                                    type="file" accept="audio/*" onChange={handleMusicChange}
                                    style={{ width: '100%', color: '#94a3b8', marginBottom: '5px' }}
                                />
                                <small style={{ color: '#64748b' }}>أو ادخل رابط صوتي مباشر:</small>
                                <input 
                                    type="text" value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)}
                                    placeholder="https://example.com/audio.mp3"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', marginTop: '5px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#334155', color: '#f1f5f9', cursor: 'pointer' }}
                                >
                                    إلغاء
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    style={{ 
                                        padding: '10px 25px', 
                                        borderRadius: '8px', 
                                        border: 'none', 
                                        backgroundColor: 'var(--accent)', 
                                        color: '#000', 
                                        fontWeight: 'bold', 
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="spinner" style={{ width: '15px', height: '15px', margin: 0 }}></div>
                                            جاري الحفظ...
                                        </>
                                    ) : (
                                        '💾 حفظ الرسالة والوضع'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDigitalLetters;
