import React, { useState, useEffect } from 'react';
import { userService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageCropper from './ImageCropper';
import CustomCalendar from './CustomCalendar';
import FriendButton from './FriendButton';
import './Modal.css';

// Admin verification badge - golden shield with checkmark
const AdminBadge = () => (
    <span title="مسؤول الموقع الرسمي" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px',
        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
        borderRadius: '50%', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(255, 165, 0, 0.5)',
        animation: 'pulse-badge 2.5s ease-in-out infinite'
    }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(255,255,255,0.15)" />
            <polyline points="9 12 11 14 15 10" />
        </svg>
    </span>
);

// Privacy toggle pill - for own profile settings
const PrivacyToggle = ({ label, checked, onChange }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0', borderBottom: '1px solid var(--bg-tertiary)'
    }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{label}</span>
        <button
            onClick={onChange}
            style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                background: checked ? '#ef4444' : '#10b981',
                cursor: 'pointer', position: 'relative', transition: 'background 0.3s ease',
                flexShrink: 0
            }}
            title={checked ? 'مخفي عن الأصدقاء' : 'مرئي للأصدقاء'}
        >
            <span style={{
                position: 'absolute', top: '2px',
                left: checked ? '2px' : '22px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'white', transition: 'left 0.3s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
        </button>
    </div>
);

const ProfileModal = ({ userId, onClose }) => {
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPrivacySettings, setShowPrivacySettings] = useState(false);
    const [privacySettings, setPrivacySettings] = useState({
        hide_username: false,
        hide_age: false,
        hide_gender: false,
        hide_marital_status: false,
        hide_workplace: false,
        hide_education: false,
        hide_bio: false,
    });
    const [formData, setFormData] = useState({
        full_name: '',
        bio: '',
        gender: '',
        date_of_birth: '',
        marital_status: '',
        workplace: '',
        education: '',
        institution: ''
    });

    const PALESTINIAN_UNIVERSITIES = [
        "جامعة بيرزيت",
        "الجامعة العربية الأمريكية - فرع رام الله",
        "جامعة النجاح الوطنية", "جامعة القدس", "جامعة الخليل",
        "جامعة بيت لحم", "جامعة بوليتكنك فلسطين", "الجامعة العربية الأمريكية - جنين",
        "جامعة القدس المفتوحة", "جامعة فلسطين التقنية - خضوري", "جامعة الاستقلال",
        "جامعة فلسطين الأهلية", "جامعة دار الكلمة للفنون والثقافة",
        "جامعة الزيتونة للعلوم والتكنولوجيا", "جامعة نابلس للتعليم المهني والتقني",
        "الجامعة الإسلامية بغزة", "جامعة الأزهر بغزة", "جامعة الأقصى",
        "جامعة غزة", "جامعة فلسطين", "جامعة الإسراء", "جامعة الأمة",
        "كلية فلسطين التقنية دير البلح", "الكلية الجامعية للعلوم التطبيقية",
        "كلية العودة الجامعية", "أكاديمية الإدارة والسياسة",
        "الكلية الجامعية للعلوم والتكنولوجيا", "كلية دار الدعوة والعلوم الإنسانية",
        "كلية فلسطين التقنية رام الله للبنات", "كلية ابن سينا للعلوم الصحية",
        "كلية الدعوة الإسلامية قلقيلية", "الكلية الجامعية للعلوم التربوية",
        "كلية فلسطين للتمريض خان يونس", "كلية بيت لحم للكتاب المقدس",
        "الالكلية العصرية الجامعية", "كلية المقاصد الجامعية",
        "المعهد الإكليريكي لبطريركية اللاتين", "كلية تنمية القدرات",
        "كلية العلوم الإسلامية - الظاهرية", "كلية الأمة الجامعية",
        "الكلية الذكية الجامعية للتعليم الحديث", "الكلية العربية للعلوم التطبيقية",
        "الكلية الدولية الجامعية للعلوم والصحة", "كلية المجتمع الإبراهيمية",
        "كلية صحة المجتمع", "كلية إنعاش الأسرة", "كلية الخليل للتمريض",
        "كلية هشام حجاوي التكنولوجية", "كلية مجتمع النجاح الوطنية",
        "كلية الحاجة عندليب العمد", "كلية الدراسات المتوسطة الأزهر",
        "كلية مجتمع الأقصى للدراسات المتوسطة", "كلية مجتمع غزة للدراسات السياحية",
        "كلية مجتمع غزة-الوكالة", "كلية العلوم التربوية - الطيرة",
        "كلية تدريب خانيونس", "كلية مجتمع طاليتا قومي",
        "كلية التمريض - مستشفى الكاريتاس", "كلية يبوس - جنين"
    ];

    const getHijriDate = (date) => {
        if (!date) return '';
        try {
            return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(new Date(date));
        } catch (e) {
            return '';
        }
    };

    const [showCropper, setShowCropper] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState(null);
    const [showCalendar, setShowCalendar] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [userId]);

    const loadProfile = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const data = await userService.getUserProfile(userId);
            setProfile(data.user);

            // Load privacy settings if own profile
            if (data.user.privacy_settings) {
                const ps = typeof data.user.privacy_settings === 'string'
                    ? JSON.parse(data.user.privacy_settings)
                    : data.user.privacy_settings;
                setPrivacySettings(ps);
            }

            setFormData({
                full_name: data.user.full_name || '',
                bio: data.user.bio || '',
                gender: data.user.gender || '',
                date_of_birth: data.user.date_of_birth ? data.user.date_of_birth.split('T')[0] : '',
                marital_status: data.user.marital_status || '',
                workplace: data.user.workplace || '',
                education: data.user.education || '',
                institution: data.user.institution || ''
            });
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            setIsSaving(true);
            const updateData = new FormData();
            updateData.append('full_name', formData.full_name);
            updateData.append('bio', formData.bio);
            updateData.append('gender', formData.gender);
            updateData.append('date_of_birth', formData.date_of_birth);
            updateData.append('marital_status', formData.marital_status);
            updateData.append('workplace', formData.workplace);
            updateData.append('education', formData.education);
            updateData.append('institution', formData.institution);
            updateData.append('privacy_settings', JSON.stringify(privacySettings));

            if (formData.profile_picture instanceof File) {
                updateData.append('profile_picture', formData.profile_picture);
            }

            const response = await userService.updateProfile(updateData);

            if (response.user) {
                setProfile(prev => ({ ...prev, ...response.user }));
                setFormData({
                    full_name: response.user.full_name || '',
                    bio: response.user.bio || '',
                    gender: response.user.gender || '',
                    date_of_birth: response.user.date_of_birth ? response.user.date_of_birth.split('T')[0] : '',
                    marital_status: response.user.marital_status || '',
                    workplace: response.user.workplace || '',
                    education: response.user.education || '',
                    institution: response.user.institution || ''
                });
            }

            await loadProfile(false);
            setEditing(false);
            setShowPrivacySettings(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('حدث خطأ أثناء حفظ التغييرات. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setTempImageSrc(reader.result);
                setShowCropper(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCropComplete = (croppedFile) => {
        setFormData({ ...formData, profile_picture: croppedFile });
        const reader = new FileReader();
        reader.onload = (ev) => {
            setProfile({ ...profile, profile_picture: ev.target.result });
        };
        reader.readAsDataURL(croppedFile);
        setShowCropper(false);
        setTempImageSrc(null);
    };

    const togglePrivacy = (key) => {
        setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isOwnProfile = currentUser && currentUser.id === userId;
    const isAdmin = profile?.role === 'admin';
    // Admin: hide username from others, show only full_name
    const showUsername = isOwnProfile || !isAdmin;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>الملف الشخصي</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : profile ? (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>

                                    {/* Gender (Right Side) */}
                                    {!editing && profile.gender && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '60px', animation: 'fadeIn 0.5s ease' }}>
                                            <div style={{
                                                width: '45px', height: '45px', borderRadius: '50%',
                                                background: profile.gender === 'male' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(236, 72, 153, 0.1)',
                                                color: profile.gender === 'male' ? '#3b82f6' : '#ec4899',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                                                border: `1px solid ${profile.gender === 'male' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)'}`
                                            }}>
                                                {profile.gender === 'male' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M16 3h5v5"></path>
                                                        <path d="M21 3l-6.75 6.75"></path>
                                                        <circle cx="10" cy="14" r="6"></circle>
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 15v7"></path>
                                                        <path d="M9 19h6"></path>
                                                        <circle cx="12" cy="9" r="6"></circle>
                                                    </svg>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                {profile.gender === 'male' ? 'ذكر' : 'أنثى'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Profile Picture */}
                                    <div className="chat-avatar" style={{
                                        width: '110px',
                                        height: '110px',
                                        border: isAdmin ? '3px solid #FFD700' : '3px solid var(--primary)',
                                        position: 'relative',
                                        borderRadius: '50%',
                                        boxShadow: isAdmin
                                            ? '0 0 20px rgba(255, 215, 0, 0.4), 0 8px 16px rgba(0,0,0,0.2)'
                                            : '0 8px 16px rgba(0,0,0,0.2)'
                                    }}>
                                        {profile.profile_picture ? (
                                            <img src={profile.profile_picture} alt={profile.username || profile.full_name} />
                                        ) : (
                                            <div className="avatar-placeholder" style={{ fontSize: '2.5rem' }}>
                                                {(profile.full_name || profile.username || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        {editing && (
                                            <>
                                                <input
                                                    type="file"
                                                    id="profile-upload"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={handleFileSelect}
                                                />
                                                <label
                                                    htmlFor="profile-upload"
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '0',
                                                        right: '0',
                                                        background: 'var(--primary)',
                                                        color: 'white',
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                                    }}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                        <circle cx="12" cy="13" r="4"></circle>
                                                    </svg>
                                                </label>
                                            </>
                                        )}
                                    </div>

                                    {/* Age (Left Side) */}
                                    {!editing && profile.date_of_birth && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '60px', animation: 'fadeIn 0.5s ease' }}>
                                            <div style={{
                                                width: '45px', height: '45px', borderRadius: '50%',
                                                background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                            }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <polyline points="12 6 12 12 16 14"></polyline>
                                                </svg>
                                            </div>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                {Math.floor((new Date() - new Date(profile.date_of_birth)) / 31557600000)} سنة
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {editing ? (
                                    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="input"
                                            placeholder="الاسم الكامل"
                                        />

                                        <select
                                            value={formData.gender}
                                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                            className="input"
                                        >
                                            <option value="">اختر الجنس</option>
                                            <option value="male">ذكر</option>
                                            <option value="female">أنثى</option>
                                        </select>

                                        <div style={{ position: 'relative' }}>
                                            <div
                                                className="input"
                                                onClick={() => setShowCalendar(true)}
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px' }}
                                            >
                                                <span>
                                                    {formData.date_of_birth || 'تاريخ الميلاد'}
                                                    {formData.date_of_birth && !isNaN(new Date(formData.date_of_birth).getTime()) && (
                                                        <span style={{ marginRight: '8px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                            ({Math.floor((new Date() - new Date(formData.date_of_birth)) / 31557600000)} سنة)
                                                        </span>
                                                    )}
                                                </span>
                                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
                                                    <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-160 0q-17 0-28.5-11.5T280-440q0-17 11.5-28.5T320-480q17 0 28.5 11.5T360-440q0 17-11.5 28.5T320-400Zm320 0q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-160 0q-17 0-28.5-11.5T280-280q0-17 11.5-28.5T320-320q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240Zm320 0q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z" />
                                                </svg>
                                            </div>
                                            {showCalendar && (
                                                <div style={{ position: 'absolute', top: '100%', left: '0', right: '0', zIndex: 10 }}>
                                                    <CustomCalendar
                                                        selectedDate={formData.date_of_birth}
                                                        onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
                                                        onClose={() => setShowCalendar(false)}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <select
                                            value={formData.marital_status}
                                            onChange={(e) => setFormData({ ...formData, marital_status: e.target.value })}
                                            className="input"
                                        >
                                            <option value="">الحالة الاجتماعية</option>
                                            <option value="single">
                                                {formData.gender === 'male' ? 'أعزب' : formData.gender === 'female' ? 'عزباء' : 'أعزب / عزباء'}
                                            </option>
                                            <option value="married">
                                                {formData.gender === 'male' ? 'متزوج' : formData.gender === 'female' ? 'متزوجة' : 'متزوج / متزوجة'}
                                            </option>
                                            <option value="engaged">
                                                {formData.gender === 'male' ? 'خاطب' : formData.gender === 'female' ? 'مخطوبة' : 'خاطب / مخطوبة'}
                                            </option>
                                            <option value="divorced">
                                                {formData.gender === 'male' ? 'مطلق' : formData.gender === 'female' ? 'مطلقة' : 'مطلق / مطلقة'}
                                            </option>
                                            <option value="widowed">
                                                {formData.gender === 'male' ? 'أرمل' : formData.gender === 'female' ? 'أرملة' : 'أرمل / أرملة'}
                                            </option>
                                        </select>

                                        <input
                                            type="text"
                                            value={formData.workplace}
                                            onChange={(e) => setFormData({ ...formData, workplace: e.target.value })}
                                            className="input"
                                            placeholder="مكان العمل"
                                        />

                                        <select
                                            value={formData.education}
                                            onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                                            className="input"
                                        >
                                            <option value="">الحالة التعليمية</option>
                                            <option value="student">طالب جامعة</option>
                                            <option value="graduate">خريج</option>
                                            <option value="not_studying">لا يدرس</option>
                                        </select>

                                        {(formData.education === 'student' || formData.education === 'graduate') && (
                                            <select
                                                value={formData.institution}
                                                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                                                className="input"
                                                style={{ animation: 'slideDown 0.3s ease' }}
                                            >
                                                <option value="">اختر اسم الجامعة / الكلية</option>
                                                {PALESTINIAN_UNIVERSITIES.map((name, idx) => (
                                                    <option key={idx} value={name}>{name}</option>
                                                ))}
                                                <option value="other">أخرى</option>
                                            </select>
                                        )}

                                        {/* Privacy Settings Toggle Section */}
                                        {isOwnProfile && (
                                            <div style={{
                                                marginTop: '10px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: '12px',
                                                overflow: 'hidden'
                                            }}>
                                                <button
                                                    onClick={() => setShowPrivacySettings(!showPrivacySettings)}
                                                    style={{
                                                        width: '100%', padding: '12px 16px',
                                                        background: 'none', border: 'none',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit',
                                                        fontSize: '0.9rem', fontWeight: '700'
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                        </svg>
                                                        إعدادات الخصوصية
                                                    </span>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                        style={{ transform: showPrivacySettings ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                                                        <polyline points="6 9 12 15 18 9"></polyline>
                                                    </svg>
                                                </button>
                                                {showPrivacySettings && (
                                                    <div style={{ padding: '0 16px 16px' }}>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                                            🟢 مرئي للأصدقاء &nbsp;|&nbsp; 🔴 مخفي عن الأصدقاء
                                                        </p>
                                                        <PrivacyToggle label="اسم المستخدم (@username)" checked={privacySettings.hide_username} onChange={() => togglePrivacy('hide_username')} />
                                                        <PrivacyToggle label="العمر / تاريخ الميلاد" checked={privacySettings.hide_age} onChange={() => togglePrivacy('hide_age')} />
                                                        <PrivacyToggle label="الجنس" checked={privacySettings.hide_gender} onChange={() => togglePrivacy('hide_gender')} />
                                                        <PrivacyToggle label="الحالة الاجتماعية" checked={privacySettings.hide_marital_status} onChange={() => togglePrivacy('hide_marital_status')} />
                                                        <PrivacyToggle label="مكان العمل" checked={privacySettings.hide_workplace} onChange={() => togglePrivacy('hide_workplace')} />
                                                        <PrivacyToggle label="الحالة التعليمية" checked={privacySettings.hide_education} onChange={() => togglePrivacy('hide_education')} />
                                                        <PrivacyToggle label="السيرة الذاتية" checked={privacySettings.hide_bio} onChange={() => togglePrivacy('hide_bio')} />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Name + Admin Badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
                                            <h2 style={{ marginBottom: 0 }}>
                                                {profile.full_name || profile.username}
                                            </h2>
                                            {isAdmin && <AdminBadge />}
                                            {!isOwnProfile && (
                                                <FriendButton
                                                    userId={profile.id}
                                                    isFriend={profile.is_friend}
                                                    hasRequest={profile.has_pending_request}
                                                    style={{ transform: 'translateY(-2px)' }}
                                                />
                                            )}
                                        </div>

                                        {/* Username - hidden for admin from others, always visible for self */}
                                        {showUsername && profile.username && (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>
                                                @{profile.username}
                                            </p>
                                        )}
                                        {/* Admin label shown instead of username to others */}
                                        {isAdmin && !isOwnProfile && (
                                            <p style={{
                                                color: '#FFD700', fontSize: '0.85rem', fontWeight: '700',
                                                marginBottom: '1rem', letterSpacing: '0.5px'
                                            }}>
                                                مسؤول الموقع الرسمي
                                            </p>
                                        )}
                                    </>
                                )}

                                {/* Extra info row (Marital Status, Workplace, Education) */}
                                {!editing && (profile.marital_status || profile.workplace || profile.education) && (
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        marginBottom: '1rem',
                                        animation: 'fadeIn 0.5s ease'
                                    }}>
                                        {profile.marital_status && (
                                            <div style={{
                                                background: 'rgba(245, 158, 11, 0.1)',
                                                color: '#f59e0b',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                border: '1px solid rgba(245, 158, 11, 0.2)'
                                            }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.77-8.77 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                                </svg>
                                                {profile.marital_status === 'single' ? (profile.gender === 'male' ? 'أعزب' : profile.gender === 'female' ? 'عزباء' : 'أعزب/عزباء') :
                                                    profile.marital_status === 'married' ? (profile.gender === 'male' ? 'متزوج' : profile.gender === 'female' ? 'متزوجة' : 'متزوج/متزوجة') :
                                                        profile.marital_status === 'engaged' ? (profile.gender === 'male' ? 'خاطب' : profile.gender === 'female' ? 'مخطوبة' : 'خاطب/مخطوبة') :
                                                            profile.marital_status === 'divorced' ? (profile.gender === 'male' ? 'مطلق' : profile.gender === 'female' ? 'مطلقة' : 'مطلق/مطلقة') :
                                                                profile.marital_status === 'widowed' ? (profile.gender === 'male' ? 'أرمل' : profile.gender === 'female' ? 'أرملة' : 'أرمل/أرملة') : profile.marital_status}
                                            </div>
                                        )}
                                        {profile.workplace && (
                                            <div style={{
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                color: '#3b82f6',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                border: '1px solid rgba(59, 130, 246, 0.2)'
                                            }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                                </svg>
                                                {profile.workplace}
                                            </div>
                                        )}
                                        {profile.education && (
                                            <div style={{
                                                background: 'rgba(139, 92, 246, 0.1)',
                                                color: '#8b5cf6',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                border: '1px solid rgba(139, 92, 246, 0.2)'
                                            }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                                                    <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                                                </svg>
                                                {profile.education === 'student' ? (profile.institution ? `يدرس في ${profile.institution}` : 'طالب جامعة') :
                                                    profile.education === 'graduate' ? (profile.institution ? `خريج من ${profile.institution}` : 'خريج') :
                                                        profile.education === 'not_studying' ? 'لا يدرس' : profile.education}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {editing ? (
                                <div className="form-group">
                                    <label>السيرة الذاتية</label>
                                    <textarea
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        className="input textarea"
                                        placeholder="اكتب نبذة عنك..."
                                        rows="3"
                                    />
                                </div>
                            ) : profile.bio && (
                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '1.5rem'
                                }}>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        {profile.bio}
                                    </p>
                                </div>
                            )}

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                gap: '0.5rem',
                                marginBottom: '1.5rem'
                            }}>
                                <div className="info-card" style={{ padding: '0.75rem' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>
                                        {profile.posts_count || 0}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        منشورات
                                    </div>
                                </div>

                                <div className="info-card" style={{ padding: '0.75rem' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--secondary)' }}>
                                        {profile.friends_count || 0}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        أصدقاء
                                    </div>
                                </div>

                                <div className="info-card" style={{ padding: '0.75rem' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#e91e63' }}>
                                        {profile.likes_count || 0}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        إعجابات
                                    </div>
                                </div>
                            </div>

                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div>انضم في {new Date(profile.created_at).toLocaleDateString('en-GB')}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>الهجري: {getHijriDate(profile.created_at)}</div>
                            </div>

                            {isOwnProfile && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    {editing ? (
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                className="btn"
                                                onClick={handleSaveProfile}
                                                disabled={isSaving}
                                                style={{
                                                    flex: 1,
                                                    background: 'linear-gradient(135deg, #fbab15 0%, #f59e0b 100%)',
                                                    color: '#000',
                                                    fontWeight: 'bold',
                                                    border: 'none',
                                                    boxShadow: '0 4px 15px rgba(251, 171, 21, 0.3)',
                                                    opacity: isSaving ? 0.8 : 1,
                                                    cursor: isSaving ? 'wait' : 'pointer',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {isSaving ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        <span className="spinner-small" style={{ borderColor: 'rgba(0,0,0,0.3)', borderTopColor: '#000' }}></span>
                                                        جاري الحفظ...
                                                    </span>
                                                ) : 'حفظ التعديلات'}
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => { setEditing(false); setShowPrivacySettings(false); }}
                                                disabled={isSaving}
                                                style={{ flex: 1 }}
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="btn"
                                            onClick={() => setEditing(true)}
                                            style={{
                                                width: '100%',
                                                background: 'linear-gradient(135deg, #fbab15 0%, #f59e0b 100%)',
                                                color: '#000',
                                                fontWeight: 'bold',
                                                border: 'none',
                                                boxShadow: '0 4px 15px rgba(251, 171, 21, 0.3)',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            تعديل الملف الشخصي
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <span className="empty-state-icon">!</span>
                            <p>لم نتمكن من تحميل الملف الشخصي</p>
                        </div>
                    )}
                </div>
            </div>

            {showCropper && tempImageSrc && (
                <ImageCropper
                    imageSrc={tempImageSrc}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setShowCropper(false);
                        setTempImageSrc(null);
                    }}
                />
            )}
        </div>
    );
};

export default ProfileModal;
