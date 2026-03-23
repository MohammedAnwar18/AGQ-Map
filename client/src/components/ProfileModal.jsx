import React, { useState, useEffect } from 'react';
import { userService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageCropper from './ImageCropper';
import CustomCalendar from './CustomCalendar';
import FriendButton from './FriendButton';
import './Modal.css';

const ProfileModal = ({ userId, onClose }) => {
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        bio: '',
        gender: '',
        date_of_birth: '',
        marital_status: '',
        workplace: '',
        education: ''
    });

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
            setFormData({
                full_name: data.user.full_name || '',
                bio: data.user.bio || '',
                gender: data.user.gender || '',
                date_of_birth: data.user.date_of_birth ? data.user.date_of_birth.split('T')[0] : '',
                marital_status: data.user.marital_status || '',
                workplace: data.user.workplace || '',
                education: data.user.education || ''
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

            if (formData.profile_picture instanceof File) {
                updateData.append('profile_picture', formData.profile_picture);
            }

            // 1. Send update to server
            const response = await userService.updateProfile(updateData);

            // 2. Update local state immediately with the response from server
            if (response.user) {
                setProfile(prev => ({ ...prev, ...response.user }));
                setFormData({
                    full_name: response.user.full_name || '',
                    bio: response.user.bio || '',
                    gender: response.user.gender || '',
                    date_of_birth: response.user.date_of_birth ? response.user.date_of_birth.split('T')[0] : '',
                    marital_status: response.user.marital_status || '',
                    workplace: response.user.workplace || '',
                    education: response.user.education || ''
                });
            }

            // 3. Fetch fresh data just to be 100% sure everything is synced
            await loadProfile(false);

            setEditing(false);
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

    const isOwnProfile = currentUser && currentUser.id === userId;

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

                                    {/* Gender (Right Side for Arabic RTL feel, or Left) - Let's put Right for "First" logic if assumed RTL flow visually */}
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

                                    <div className="chat-avatar" style={{
                                        width: '110px',
                                        height: '110px',
                                        border: '3px solid var(--primary)',
                                        position: 'relative',
                                        borderRadius: '50%',
                                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                                    }}>
                                        {profile.profile_picture ? (
                                            <img src={profile.profile_picture} alt={profile.username} />
                                        ) : (
                                            <div className="avatar-placeholder" style={{ fontSize: '2.5rem' }}>
                                                {profile.username.charAt(0).toUpperCase()}
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
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                            <h2 style={{ marginBottom: '0.5rem' }}>
                                                {profile.full_name || profile.username}
                                            </h2>
                                            {!isOwnProfile && (
                                                <FriendButton
                                                    userId={profile.id}
                                                    isFriend={profile.is_friend}
                                                    hasRequest={profile.has_pending_request}
                                                    style={{ transform: 'translateY(-2px)' }}
                                                />
                                            )}
                                        </div>


                                    </>
                                )}

                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>
                                    @{profile.username}
                                </p>

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
                                                {profile.education === 'student' ? 'طالب جامعة' :
                                                    profile.education === 'graduate' ? 'خريج' :
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
                                                onClick={() => setEditing(false)}
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

            {
                showCropper && tempImageSrc && (
                    <ImageCropper
                        imageSrc={tempImageSrc}
                        onCropComplete={handleCropComplete}
                        onCancel={() => {
                            setShowCropper(false);
                            setTempImageSrc(null);
                        }}
                    />
                )
            }
        </div >
    );
};

export default ProfileModal;
