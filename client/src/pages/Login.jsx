import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import CustomCalendar from '../components/CustomCalendar';
import './Login.css';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isOtpStep, setIsOtpStep] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);

    // Forgot Password State
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetStep, setResetStep] = useState(1); // 1: Email, 2: OTP & New Password

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        full_name: '',
        date_of_birth: '',
        gender: ''
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let response;
            if (isForgotPassword) {
                if (resetStep === 1) {
                    // طلب استعادة كلمة المرور
                    response = await authService.forgotPassword(formData.email);
                    setResetStep(2);
                    if (response.message) {
                        alert(response.message);
                    }
                } else {
                    // إعادة تعيين كلمة المرور
                    response = await authService.resetPassword({
                        email: formData.email,
                        otp: otpCode,
                        newPassword: formData.password
                    });
                    // العودة لتسجيل الدخول بعد النجاح
                    setIsForgotPassword(false);
                    setResetStep(1);
                    setIsLogin(true);
                    setOtpCode('');
                    setFormData(prev => ({ ...prev, password: '' }));
                    setError('تم تغيير كلمة المرور بنجاح، يرجى تسجيل الدخول');
                    // يمكنك استخدام حالة نجاح بدلاً من الخطأ لعرض الرسالة باللون الأخضر
                }
            } else if (isLogin) {
                if (isOtpStep) {
                    // التحقق من OTP
                    response = await authService.verifyOtp({
                        email: formData.email,
                        otp: otpCode
                    });

                    login(response.user, response.token);
                    navigate('/map');
                } else {
                    // تسجيل الدخول الأولي
                    response = await authService.login({
                        username: formData.username,
                        password: formData.password
                    });

                    if (response.requireOtp) {
                        setIsOtpStep(true);
                        setFormData(prev => ({ ...prev, email: response.email }));
                        if (response.message) {
                            alert(response.message);
                        }
                    } else {
                        login(response.user, response.token);
                        navigate('/map');
                    }
                }
            } else {
                response = await authService.register({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                    full_name: formData.full_name,
                    date_of_birth: formData.date_of_birth,
                    gender: formData.gender
                });

                if (response.requireOtp) {
                    setIsLogin(true);
                    setIsOtpStep(true);
                    // formData.email is already correct
                    if (response.message) {
                        alert(response.message);
                    }
                } else {
                    login(response.user, response.token);
                    navigate('/map');
                }
            }
        } catch (error) {
            console.error('Connection Error:', error);
            const status = error.response?.status;
            const dataError = error.response?.data?.error;
            const detail = error.message;

            let errorStr = 'حدث خطأ في الاتصال بالسيرفر';
            if (status) errorStr += ` (Status: ${status})`;
            if (dataError) errorStr = dataError;
            else if (detail) errorStr += ` - [${detail}]`;

            setError(errorStr);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="login-content fade-in">
                <div className="login-header">
                    <div className="logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
                        <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '1rem' }}>
                            <style>
                                {`
                                @keyframes pulse-circle-anim {
                                    0%, 100% { opacity: 0.3; transform: scale(1.2); }
                                    50% { opacity: 0.1; transform: scale(1.3); }
                                }
                                .pulse-circle {
                                    animation: pulse-circle-anim 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                                    transform-origin: center;
                                }
                                `}
                            </style>
                            <circle className="pulse-circle" cx="50" cy="50" r="35" stroke="white" strokeWidth="2" />
                            <path d="M50 15C36.2 15 25 26.2 25 40C25 58.75 50 85 50 85C50 85 75 58.75 75 40C75 26.2 63.8 15 50 15ZM50 48.75C45.175 48.75 41.25 44.825 41.25 40C41.25 35.175 45.175 31.25 50 31.25C54.825 31.25 58.75 35.175 58.75 40C58.75 44.825 54.825 48.75 50 48.75Z" fill="white"/>
                        </svg>
                        <h1 
                            style={{ 
                                fontSize: '2.25rem', /* text-4xl */
                                fontWeight: 'bold', /* font-bold */
                                color: 'white', /* text-white */
                                letterSpacing: '0.1em', /* tracking-widest */
                                margin: 0,
                                marginBottom: '0.75rem', /* mb-3 */
                                textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                                zIndex: 1
                            }}
                        >
                            PALNOVAA
                        </h1>
                    </div>
                    <p className="tagline">اكتشف العالم من حولك، شارك لحظاتك المكانية</p>
                </div>

                <div className="login-card glass">
                    <div className="card-header">
                        <h2>
                            {isForgotPassword ? 'استعادة كلمة المرور' :
                                (!isLogin ? 'إنشاء حساب جديد' : 'تسجيل الدخول')}
                        </h2>
                        <p className="subtitle">
                            {isForgotPassword ? 'أدخل بريدك الإلكتروني لاستلام رمز التحقق' :
                                (!isLogin ? 'انضم إلى المجتمع' : 'مرحباً بعودتك!')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && (
                            <div className="error-message">
                                <span className="error-icon">⚠️</span>
                                {error}
                            </div>
                        )}

                        {isForgotPassword ? (
                            <>
                                {resetStep === 1 ? (
                                    <div className="form-group">
                                        <label htmlFor="email">البريد الإلكتروني</label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="input"
                                            placeholder="email@example.com"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="form-group fade-in">
                                            <label htmlFor="otp">رمز التحقق</label>
                                            <p className="text-sm text-gray-400 mb-2">
                                                تم إرسال رمز التحقق إلى بريدك الإلكتروني: {formData.email}
                                            </p>
                                            <input
                                                type="text"
                                                id="otp"
                                                name="otp"
                                                value={otpCode}
                                                onChange={(e) => setOtpCode(e.target.value)}
                                                className="input text-center text-2xl tracking-widest"
                                                placeholder="000000"
                                                required
                                                maxLength={6}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="newPassword">كلمة المرور الجديدة</label>
                                            <input
                                                type="password"
                                                id="newPassword"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                className="input"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {!isOtpStep && (
                                    <>
                                        <div className="form-group">
                                            <label htmlFor="username">{isLogin ? 'اسم المستخدم أو البريد الإلكتروني' : 'اسم المستخدم للدخول (بالإنجليزي)'}</label>
                                            <input
                                                type="text"
                                                id="username"
                                                name="username"
                                                value={formData.username}
                                                onChange={handleChange}
                                                className="input"
                                                placeholder="أدخل اسم المستخدم"
                                                required
                                                autoFocus
                                            />
                                        </div>

                                        {!isLogin && (
                                            <>
                                                <div className="form-group">
                                                    <label htmlFor="email">البريد الإلكتروني</label>
                                                    <input
                                                        type="email"
                                                        id="email"
                                                        name="email"
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        className="input"
                                                        placeholder="email@example.com"
                                                        required
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="full_name">الاسم الكامل (سيظهر للجميع)</label>
                                                    <input
                                                        type="text"
                                                        id="full_name"
                                                        name="full_name"
                                                        value={formData.full_name}
                                                        onChange={handleChange}
                                                        className="input"
                                                        placeholder="أدخل اسمك الكامل"
                                                        required
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="gender">الجنس</label>
                                                    <select
                                                        id="gender"
                                                        name="gender"
                                                        value={formData.gender || ''}
                                                        onChange={handleChange}
                                                        className="input"
                                                        required
                                                    >
                                                        <option value="">اختر الجنس</option>
                                                        <option value="male">ذكر</option>
                                                        <option value="female">أنثى</option>
                                                    </select>
                                                </div>

                                                <div className="form-group" style={{ position: 'relative' }}>
                                                    <label htmlFor="date_of_birth">تاريخ الميلاد</label>
                                                    <div
                                                        className="input"
                                                        onClick={() => setShowCalendar(true)}
                                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                                    >
                                                        <span>{formData.date_of_birth || 'DD/MM/YYYY'}</span>
                                                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#fff">
                                                            <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-160 0q-17 0-28.5-11.5T280-440q0-17 11.5-28.5T320-480q17 0 28.5 11.5T360-440q0 17-11.5 28.5T320-400Zm320 0q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-160 0q-17 0-28.5-11.5T280-280q0-17 11.5-28.5T320-320q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240Zm320 0q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z" />
                                                        </svg>
                                                    </div>
                                                    {showCalendar && (
                                                        <div style={{ position: 'absolute', bottom: '100%', left: '0', right: '0', zIndex: 100 }}>
                                                            <CustomCalendar
                                                                selectedDate={formData.date_of_birth}
                                                                onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
                                                                onClose={() => setShowCalendar(false)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        <div className="form-group">
                                            <label htmlFor="password">كلمة المرور</label>
                                            <input
                                                type="password"
                                                id="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                className="input"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                    </>
                                )}

                                {isOtpStep && (
                                    <div className="form-group fade-in">
                                        <label htmlFor="otp">رمز التحقق</label>
                                        <p className="text-sm text-gray-400 mb-2">
                                            تم إرسال رمز التحقق إلى بريدك الإلكتروني: {formData.email}
                                        </p>
                                        <input
                                            type="text"
                                            id="otp"
                                            name="otp"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value)}
                                            className="input text-center text-2xl tracking-widest"
                                            placeholder="000000"
                                            required
                                            maxLength={6}
                                            autoFocus
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-submit"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <div className="spinner-small"></div>
                                            جاري المعالجة...
                                        </>
                                    ) : (
                                        isLogin ? (isOtpStep ? 'تحقق' : 'دخول') : 'إنشاء الحساب'
                                    )}
                                </button>
                            </>
                        )}

                        {isForgotPassword && (
                            <button
                                type="submit"
                                className="btn btn-primary btn-submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner-small"></div>
                                        جاري المعالجة...
                                    </>
                                ) : (
                                    resetStep === 1 ? 'إرسال الرمز' : 'تعيين كلمة المرور'
                                )}
                            </button>
                        )}
                    </form>

                    <div className="card-footer">
                        {isForgotPassword ? (
                            <p>
                                <button
                                    className="toggle-btn"
                                    onClick={() => {
                                        setIsForgotPassword(false);
                                        setResetStep(1);
                                        setError('');
                                    }}
                                >
                                    العودة لتسجيل الدخول
                                </button>
                            </p>
                        ) : isOtpStep ? (
                            <p>
                                <button
                                    className="toggle-btn"
                                    onClick={() => {
                                        setIsOtpStep(false);
                                        setError('');
                                    }}
                                >
                                    العودة لتسجيل الدخول
                                </button>
                            </p>
                        ) : (
                            <>
                                <p>
                                    {isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
                                    <button
                                        className="toggle-btn"
                                        onClick={() => setIsLogin(!isLogin)}
                                    >
                                        {isLogin ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
                                    </button>
                                </p>
                                {isLogin && (
                                    <p style={{ marginTop: '10px' }}>
                                        <button
                                            className="toggle-btn"
                                            style={{ fontSize: '0.9em', opacity: 0.8 }}
                                            onClick={() => {
                                                setIsForgotPassword(true);
                                                setError('');
                                                setFormData({ ...formData, email: '' });
                                            }}
                                        >
                                            نسيت كلمة المرور؟
                                        </button>
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="features">

                </div>
            </div>

            <div style={{
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '0.95rem',
                fontFamily: 'Tajawal, sans-serif',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                letterSpacing: '0.5px',
                marginTop: '2rem',
                paddingBottom: '2rem'
            }}>
                <p style={{ margin: 0, padding: 0, fontWeight: '600' }}>
                    &copy; {new Date().getFullYear()} PalNovaa. جميع الحقوق محفوظة.
                </p>
            </div>
        </div>
    );
};

export default Login;
