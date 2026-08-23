import React, { useState, useEffect, useRef, useCallback } from 'react';
import { adminService } from '../services/adminApi';
import { getImageUrl } from '../services/api';
import './AdminFaceRecognition.css';

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const CONFIDENCE_COLORS = {
    very_high: '#10b981',
    high: '#22c55e',
    possible: '#f59e0b',
    none: '#6b7280'
};

function fileTooBig(file) {
    return file && file.size > MAX_UPLOAD_BYTES;
}

// ─── Person form modal (create / edit) ──────────────────────────────────────
function PersonFormModal({ person, onClose, onSaved }) {
    const isEdit = !!person;
    const [name, setName] = useState(person?.name || '');
    const [info, setInfo] = useState(person?.info || '');
    const [files, setFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleFilesChange = (e) => {
        const selected = Array.from(e.target.files || []);
        const oversized = selected.find(fileTooBig);
        if (oversized) {
            setError(`الصورة "${oversized.name}" أكبر من الحد المسموح (${MAX_UPLOAD_MB} ميجابايت)`);
            return;
        }
        if (selected.length > 5) {
            setError('يمكن رفع 5 صور كحد أقصى في المرة الواحدة');
            return;
        }
        setError('');
        setFiles(selected);
        setPreviews(selected.map(f => URL.createObjectURL(f)));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError('الاسم مطلوب');
        if (!isEdit && files.length === 0) return setError('يجب رفع صورة واحدة على الأقل');

        setSaving(true);
        setError('');
        try {
            if (isEdit) {
                await adminService.updateFacePerson(person.id, { name, info });
                if (files.length > 0) {
                    const fd = new FormData();
                    files.forEach(f => fd.append('photos', f));
                    await adminService.addFacePersonPhotos(person.id, fd);
                }
            } else {
                const fd = new FormData();
                fd.append('name', name);
                fd.append('info', info);
                files.forEach(f => fd.append('photos', f));
                await adminService.createFacePerson(fd);
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.error || 'حدث خطأ أثناء الحفظ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="face-modal-overlay" onClick={onClose}>
            <div className="face-modal" onClick={e => e.stopPropagation()}>
                <div className="face-modal-header">
                    <h3>{isEdit ? `✏️ تعديل بيانات ${person.name}` : '➕ إضافة شخص جديد'}</h3>
                    <button className="face-modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="face-modal-body">
                    <label className="face-field-label">الاسم الكامل</label>
                    <input
                        className="face-input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="اسم الشخص"
                        required
                    />

                    <label className="face-field-label">معلومات إضافية</label>
                    <textarea
                        className="face-textarea"
                        value={info}
                        onChange={e => setInfo(e.target.value)}
                        placeholder="أي تفاصيل تعريفية إضافية عن هذا الشخص..."
                        rows={4}
                    />

                    <label className="face-field-label">
                        {isEdit ? 'إضافة صور مرجعية جديدة (اختياري)' : 'صور الوجه المرجعية'}
                        <span className="face-field-hint"> — صورة واضحة تحتوي وجه شخص واحد فقط، حتى {MAX_UPLOAD_MB}MB لكل صورة</span>
                    </label>
                    <input type="file" accept="image/*" multiple onChange={handleFilesChange} className="face-file-input" />

                    {previews.length > 0 && (
                        <div className="face-preview-row">
                            {previews.map((src, i) => (
                                <img key={i} src={src} alt="preview" className="face-preview-thumb" />
                            ))}
                        </div>
                    )}

                    {error && <div className="face-error-box">{error}</div>}

                    <button type="submit" className="face-btn-primary" disabled={saving}>
                        {saving ? 'جاري الحفظ...' : (isEdit ? '💾 حفظ التعديلات' : '✅ إنشاء السجل')}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Person detail modal (photos management) ────────────────────────────────
function PersonDetailModal({ personId, onClose, onChanged }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminService.getFacePersonDetails(personId);
            setData(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [personId]);

    useEffect(() => { load(); }, [load]);

    const handleDeletePhoto = async (photoId) => {
        if (!window.confirm('حذف هذه الصورة المرجعية نهائياً؟')) return;
        try {
            await adminService.deleteFacePhoto(photoId);
            load();
            onChanged();
        } catch (err) {
            alert(err.response?.data?.error || 'فشل حذف الصورة');
        }
    };

    return (
        <div className="face-modal-overlay" onClick={onClose}>
            <div className="face-modal" onClick={e => e.stopPropagation()}>
                <div className="face-modal-header">
                    <h3>👤 {data?.person?.name || '...'}</h3>
                    <button className="face-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="face-modal-body">
                    {loading ? (
                        <div className="face-spinner" />
                    ) : (
                        <>
                            {data?.person?.info && <p className="face-info-text">{data.person.info}</p>}
                            <label className="face-field-label">الصور المرجعية ({data?.photos?.length || 0})</label>
                            <div className="face-photo-grid">
                                {data?.photos?.map(photo => (
                                    <div key={photo.id} className="face-photo-card">
                                        <img src={getImageUrl(photo.photo_url)} alt="reference" />
                                        <button className="face-photo-delete" onClick={() => handleDeletePhoto(photo.id)} title="حذف الصورة">🗑️</button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── People registry tab ─────────────────────────────────────────────────────
function PeopleRegistry() {
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingPerson, setEditingPerson] = useState(null);
    const [viewingPersonId, setViewingPersonId] = useState(null);

    const loadPeople = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminService.getFacePeople(search, page, 12);
            setPeople(res.people);
            setPagination(res.pagination);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    useEffect(() => { loadPeople(); }, [loadPeople]);

    const handleDelete = async (person) => {
        if (!window.confirm(`هل أنت متأكد من حذف "${person.name}" وكل صوره المرجعية نهائياً؟`)) return;
        try {
            await adminService.deleteFacePerson(person.id);
            loadPeople();
        } catch (err) {
            alert(err.response?.data?.error || 'فشل الحذف');
        }
    };

    return (
        <div>
            <div className="face-toolbar">
                <div className="face-search-box">
                    <input
                        placeholder="بحث بالاسم..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                    <span>🔍</span>
                </div>
                <button className="face-btn-primary" onClick={() => setShowForm(true)}>➕ إضافة شخص جديد</button>
            </div>

            {loading ? (
                <div className="face-spinner" />
            ) : people.length === 0 ? (
                <div className="face-empty-state">
                    <span>🗂️</span>
                    <p>لا يوجد أشخاص مسجلون بعد. ابدأ بإضافة أول سجل.</p>
                </div>
            ) : (
                <div className="face-people-grid">
                    {people.map(p => (
                        <div key={p.id} className="face-person-card">
                            <div className="face-person-cover" onClick={() => setViewingPersonId(p.id)}>
                                {p.cover_photo ? (
                                    <img src={getImageUrl(p.cover_photo)} alt={p.name} />
                                ) : (
                                    <div className="face-person-cover-placeholder">👤</div>
                                )}
                            </div>
                            <div className="face-person-body">
                                <h4>{p.name}</h4>
                                <p className="face-person-info">{p.info || 'بدون معلومات إضافية'}</p>
                                <span className="face-photo-count-badge">{p.photo_count} صورة مرجعية</span>
                            </div>
                            <div className="face-person-actions">
                                <button onClick={() => setViewingPersonId(p.id)} title="عرض الصور">🖼️</button>
                                <button onClick={() => setEditingPerson(p)} title="تعديل">✏️</button>
                                <button onClick={() => handleDelete(p)} title="حذف" className="destructive">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pagination && pagination.totalPages > 1 && (
                <div className="pagination">
                    {[...Array(pagination.totalPages)].map((_, i) => (
                        <button key={i + 1} className={page === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>
                    ))}
                </div>
            )}

            {showForm && (
                <PersonFormModal
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); loadPeople(); }}
                />
            )}
            {editingPerson && (
                <PersonFormModal
                    person={editingPerson}
                    onClose={() => setEditingPerson(null)}
                    onSaved={() => { setEditingPerson(null); loadPeople(); }}
                />
            )}
            {viewingPersonId && (
                <PersonDetailModal
                    personId={viewingPersonId}
                    onClose={() => setViewingPersonId(null)}
                    onChanged={loadPeople}
                />
            )}
        </div>
    );
}

// ─── Face crop preview (draws detected box on top of the uploaded image) ────
function FaceCropThumb({ imageSrc, box, imageWidth, imageHeight }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!imageSrc || !box) return;
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const scaleX = img.naturalWidth / imageWidth;
            const scaleY = img.naturalHeight / imageHeight;
            const sx = box.x * scaleX;
            const sy = box.y * scaleY;
            const sw = box.width * scaleX;
            const sh = box.height * scaleY;
            canvas.width = 120;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 120, 120);
        };
        img.src = imageSrc;
    }, [imageSrc, box, imageWidth, imageHeight]);

    return <canvas ref={canvasRef} className="face-crop-canvas" />;
}

// ─── Image search tab ────────────────────────────────────────────────────────
function ImageSearch() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        setResult(null);
        setError('');
        if (!f) return;
        if (fileTooBig(f)) {
            setError(`حجم الصورة أكبر من الحد المسموح (${MAX_UPLOAD_MB} ميجابايت)`);
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setAnalyzing(true);
        setError('');
        setResult(null);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminService.searchFaceByImage(fd);
            setResult(res);
        } catch (err) {
            setError(err.response?.data?.error || 'فشل تحليل الصورة');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="face-search-panel">
            <div className="face-search-upload-zone">
                <label className="face-upload-dropzone">
                    <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                    {preview ? (
                        <img src={preview} alt="query" className="face-query-preview" />
                    ) : (
                        <div className="face-upload-placeholder">
                            <span>📷</span>
                            <p>اضغط لرفع صورة للتحليل والمقارنة</p>
                            <small>حتى {MAX_UPLOAD_MB} ميجابايت — JPG / PNG</small>
                        </div>
                    )}
                </label>
                {file && (
                    <button className="face-btn-primary" onClick={handleAnalyze} disabled={analyzing}>
                        {analyzing ? 'جاري تحليل الوجه ومطابقته...' : '🔎 تحليل ومطابقة الوجه'}
                    </button>
                )}
                {error && <div className="face-error-box">{error}</div>}
            </div>

            {analyzing && (
                <div className="face-analyzing-note">
                    <div className="face-spinner" />
                    <p>يتم الآن استخراج ملامح الوجه ومقارنتها بكل السجلات المخزنة محلياً...</p>
                </div>
            )}

            {result && result.facesDetected === 0 && (
                <div className="face-empty-state">
                    <span>🚫</span>
                    <p>{result.message}</p>
                </div>
            )}

            {result && result.faces && result.faces.length > 0 && (
                <div className="face-results-area">
                    {result.faces.length > 1 && (
                        <div className="face-multi-warning">⚠️ تم اكتشاف {result.faces.length} وجوه في الصورة، تم تحليل ومطابقة كل وجه على حدة أدناه.</div>
                    )}
                    {result.faces.map((face, idx) => (
                        <div key={idx} className="face-result-block">
                            <div className="face-result-header">
                                <FaceCropThumb imageSrc={preview} box={face.box} imageWidth={face.imageWidth} imageHeight={face.imageHeight} />
                                <div>
                                    <h4>الوجه رقم {idx + 1}</h4>
                                    <small>ثقة الاكتشاف: {(face.detectionScore * 100).toFixed(0)}%</small>
                                </div>
                            </div>

                            {face.candidates.length === 0 ? (
                                <p className="face-info-text">لا توجد سجلات في قاعدة البيانات للمقارنة بعد.</p>
                            ) : (
                                <div className="face-candidates-list">
                                    {face.candidates.map((c, ci) => (
                                        <div key={ci} className="face-candidate-row" style={{ borderInlineStartColor: CONFIDENCE_COLORS[c.level] }}>
                                            <img src={getImageUrl(c.matchedPhotoUrl)} alt={c.name} className="face-candidate-thumb" />
                                            <div className="face-candidate-info">
                                                <h5>{c.name}</h5>
                                                {c.info && <p>{c.info}</p>}
                                            </div>
                                            <div className="face-candidate-score" style={{ color: CONFIDENCE_COLORS[c.level] }}>
                                                <strong>{c.label}</strong>
                                                <small>نسبة تشابه تقريبية: {c.confidencePercent}% • مسافة: {c.distance}</small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function AdminFaceRecognition() {
    const [tab, setTab] = useState('registry');

    return (
        <div className="face-recognition-panel">
            <div className="face-panel-header">
                <div>
                    <h3>🧬 نظام التعرف على الوجوه</h3>
                    <p>تسجيل الأشخاص بصورهم المرجعية، ثم رفع صورة لتحليلها ومطابقتها آلياً بدقة عالية مع قاعدة البيانات.</p>
                </div>
                <div className="face-tab-switch">
                    <button className={tab === 'registry' ? 'active' : ''} onClick={() => setTab('registry')}>👥 سجل الأشخاص</button>
                    <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>🔎 بحث بالصورة</button>
                </div>
            </div>

            {tab === 'registry' ? <PeopleRegistry /> : <ImageSearch />}
        </div>
    );
}
