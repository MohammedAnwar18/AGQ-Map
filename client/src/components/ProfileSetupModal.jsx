import React, { useState, useRef } from 'react';
import { userService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DefaultAvatar from './DefaultAvatar';
import ImageCropper from './ImageCropper';

const ProfileSetupModal = ({ onClose }) => {
    const { user, updateUser } = useAuth();
    const [gender, setGender] = useState(user?.gender || 'male');
    const [tempImageSrc, setTempImageSrc] = useState(null);
    const [showCropper, setShowCropper] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [croppedFile, setCroppedFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = () => {
                setTempImageSrc(reader.result);
                setShowCropper(true);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCropComplete = (file) => {
        setCroppedFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewUrl(ev.target.result);
        reader.readAsDataURL(file);
        setShowCropper(false);
        setTempImageSrc(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            if (croppedFile) {
                formData.append('profile_picture', croppedFile);
            }
            formData.append('gender', gender);
            
            const data = await userService.updateProfile(formData);
            updateUser({ 
                profile_picture: data.user?.profile_picture || user?.profile_picture || previewUrl,
                gender: data.user?.gender || gender
            });
            onClose();
        } catch {
            alert('حدث خطأ أثناء حفظ التعديلات. حاول مرة أخرى.');
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('gender', gender);
            const data = await userService.updateProfile(formData);
            updateUser({ gender: data.user?.gender || gender });
            onClose();
        } catch {
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (showCropper && tempImageSrc) {
        return (
            <div style={styles.overlay}>
                <div style={{ ...styles.card, maxWidth: 420 }}>
                    <ImageCropper
                        imageSrc={tempImageSrc}
                        onCropComplete={handleCropComplete}
                        onCancel={() => { setShowCropper(false); setTempImageSrc(null); }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                {/* Decorative blobs */}
                <div style={styles.blobTop} />
                <div style={styles.blobBottom} />

                {/* Content */}
                <div style={styles.content}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
                        <div style={styles.waveEmoji}>👋</div>
                        <h2 style={styles.title}>أهلاً وسهلاً!</h2>
                        <p style={styles.subtitle}>أضف صورة شخصية لتميّز ملفك الآن</p>
                    </div>

                    {/* Avatar Preview */}
                    <div style={styles.avatarWrapper} onClick={() => fileInputRef.current?.click()}>
                        <div style={styles.avatarRing}>
                            {previewUrl ? (
                                <img src={previewUrl} alt="preview" style={styles.previewImg} />
                            ) : (
                                <DefaultAvatar gender={gender} size={110} uid={String(user?.id || 'setup')} />
                            )}
                        </div>
                        <div style={styles.cameraBtn}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="18" height="18">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                        </div>
                        <p style={styles.tapHint}>اضغط لاختيار صورة</p>
                    </div>

                    {/* Gender Selection */}
                    <div style={styles.genderContainer}>
                        <p style={styles.genderLabel}>حدد الجنس لتخصيص الهوية الافتراضية:</p>
                        <div style={styles.genderOptions}>
                            <button
                                style={{
                                    ...styles.genderBtn,
                                    ...(gender === 'male' ? styles.genderBtnActiveMale : {})
                                }}
                                onClick={() => setGender('male')}
                            >
                                <span style={{ fontSize: '1.1rem' }}>👨</span> ذكر
                            </button>
                            <button
                                style={{
                                    ...styles.genderBtn,
                                    ...(gender === 'female' ? styles.genderBtnActiveFemale : {})
                                }}
                                onClick={() => setGender('female')}
                            >
                                <span style={{ fontSize: '1.1rem' }}>👩</span> أنثى
                            </button>
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />

                    {/* Upload button */}
                    <button style={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        اختر صورة من الجهاز
                    </button>

                    {/* Action buttons */}
                    <div style={styles.actions}>
                        <button style={styles.skipBtn} onClick={handleSkip} disabled={saving}>
                            {saving && !croppedFile ? 'جاري الحفظ...' : 'تخطي الآن'}
                        </button>
                        {croppedFile && (
                            <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <span style={styles.spinnerWrap}>
                                        <span style={styles.spinner} />
                                        جارٍ الحفظ...
                                    </span>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="17" height="17">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        حفظ الصورة
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <p style={styles.hint}>يمكنك تغيير الصورة في أي وقت من ملفك الشخصي</p>
                </div>
            </div>

            <style>{`
                @keyframes psm-fadein {
                    from { opacity: 0; transform: translateY(24px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes psm-wave {
                    0%,100% { transform: rotate(-10deg); }
                    50%     { transform: rotate(14deg); }
                }
                @keyframes psm-spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes psm-pulse-ring {
                    0%,100% { box-shadow: 0 0 0 0 rgba(251,171,21,0.3); }
                    50%     { box-shadow: 0 0 0 10px rgba(251,171,21,0); }
                }
            `}</style>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,16,32,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '20px',
    },
    card: {
        position: 'relative',
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '380px',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        animation: 'psm-fadein 0.4s cubic-bezier(0.16,1,0.3,1)',
    },
    blobTop: {
        position: 'absolute',
        top: '-60px',
        left: '-60px',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,171,21,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    blobBottom: {
        position: 'absolute',
        bottom: '-60px',
        right: '-60px',
        width: '220px',
        height: '220px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    content: {
        position: 'relative',
        zIndex: 1,
        padding: '2rem 1.75rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    waveEmoji: {
        fontSize: '2.4rem',
        display: 'inline-block',
        animation: 'psm-wave 1.2s ease-in-out 0.3s 3',
        transformOrigin: '70% 80%',
        marginBottom: '0.5rem',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#f8fafc',
        margin: '0 0 0.4rem',
    },
    subtitle: {
        fontSize: '0.9rem',
        color: '#94a3b8',
        margin: 0,
    },
    avatarWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        marginBottom: '1.2rem',
    },
    avatarRing: {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        border: '3px solid var(--primary, #fbab15)',
        padding: '3px',
        position: 'relative',
        animation: 'psm-pulse-ring 2.5s ease-in-out infinite',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.03)',
    },
    previewImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '50%',
    },
    cameraBtn: {
        position: 'absolute',
        bottom: '8px',
        right: '-8px',
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        background: 'var(--primary, #fbab15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        border: '2px solid rgba(15,23,42,0.9)',
    },
    tapHint: {
        fontSize: '0.78rem',
        color: '#64748b',
        margin: '0.3rem 0 0',
    },
    uploadBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'rgba(251,171,21,0.12)',
        color: 'var(--primary, #fbab15)',
        border: '1px solid rgba(251,171,21,0.3)',
        borderRadius: '12px',
        padding: '0.7rem 1.4rem',
        fontSize: '0.9rem',
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
        justifyContent: 'center',
        marginBottom: '1rem',
        transition: 'background 0.2s',
    },
    actions: {
        display: 'flex',
        gap: '0.75rem',
        width: '100%',
        marginBottom: '1rem',
    },
    skipBtn: {
        flex: 1,
        padding: '0.7rem',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)',
        color: '#94a3b8',
        fontSize: '0.88rem',
        cursor: 'pointer',
        transition: 'background 0.2s',
    },
    saveBtn: {
        flex: 1,
        padding: '0.7rem',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #fbab15, #d97706)',
        color: '#0f172a',
        fontSize: '0.88rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        boxShadow: '0 4px 14px rgba(251,171,21,0.35)',
    },
    spinnerWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    spinner: {
        width: '14px',
        height: '14px',
        border: '2px solid rgba(15,23,42,0.3)',
        borderTop: '2px solid #0f172a',
        borderRadius: '50%',
        animation: 'psm-spin 0.7s linear infinite',
        display: 'inline-block',
    },
    hint: {
        fontSize: '0.75rem',
        color: '#475569',
        margin: 0,
        textAlign: 'center',
    },
    genderContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
        marginBottom: '1.2rem',
    },
    genderLabel: {
        fontSize: '0.82rem',
        color: '#64748b',
        margin: 0,
        fontWeight: 600,
    },
    genderOptions: {
        display: 'flex',
        gap: '0.75rem',
        width: '100%',
        maxWidth: '280px',
    },
    genderBtn: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        padding: '0.55rem 0',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.03)',
        color: '#94a3b8',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    genderBtnActiveMale: {
        background: 'rgba(56,189,248,0.12)',
        color: '#38bdf8',
        border: '1px solid rgba(56,189,248,0.3)',
        boxShadow: '0 0 12px rgba(56,189,248,0.15)',
    },
    genderBtnActiveFemale: {
        background: 'rgba(244,114,182,0.12)',
        color: '#f472b6',
        border: '1px solid rgba(244,114,182,0.3)',
        boxShadow: '0 0 12px rgba(244,114,182,0.15)',
    },
};

export default ProfileSetupModal;
