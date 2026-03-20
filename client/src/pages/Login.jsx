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
                    <div className="logo">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 500.000000 500.000000"
                            preserveAspectRatio="xMidYMid meet"
                            className="logo-image"
                        >
                            <g transform="translate(0.000000,500.000000) scale(0.100000,-0.100000)"
                                fill="#92400e" stroke="none">
                                <path d="M2405 4330 c-192 -50 -340 -198 -396 -395 -18 -63 -18 -241 0 -315 20 -82 70 -227 102 -294 16 -33 29 -65 29 -71 0 -7 -27 -18 -59 -24 l-60 -12 -233 -286 c-128 -157 -238 -291 -243 -297 -13 -13 -199 -241 -308 -375 -42 -52 -76 -100 -74 -106 7 -19 72 -9 212 34 77 24 154 47 170 51 17 5 68 20 115 34 47 14 93 26 102 26 9 0 149 -67 310 -149 l293 -149 55 15 c30 8 87 23 125 33 39 10 122 32 185 49 63 17 143 38 178 47 l62 17 160 191 c87 105 198 238 245 296 48 58 97 116 109 130 12 14 46 54 75 90 29 36 70 85 91 110 140 167 170 206 170 222 0 27 4 28 -347 -61 -133 -34 -249 -61 -258 -61 -13 0 -229 105 -263 128 -9 6 -6 20 13 61 77 158 119 293 137 436 29 238 -92 469 -304 581 -121 63 -261 79 -393 44z m237 -51 c171 -36 321 -172 381 -347 25 -74 26 -228 2 -327 -56 -235 -206 -518 -409 -772 -27 -35 -53 -63 -56 -63 -11 0 -189 228 -246 316 -113 172 -204 374 -245 544 -18 72 -18 254 0 300 34 90 71 149 131 210 121 123 279 173 442 139z m-449 -1111 c8 -13 33 -53 57 -91 45 -72 45 -73 0 -117 -3 -3 -25 -30 -50 -60 -25 -30 -52 -64 -61 -75 -10 -11 -46 -54 -80 -96 -35 -42 -118 -142 -183 -223 l-119 -146 -66 -20 c-154 -46 -406 -118 -408 -116 -1 1 26 36 60 77 34 42 113 138 176 215 63 76 141 171 172 209 32 39 126 153 209 255 126 154 157 187 188 196 60 19 90 17 105 -8z m848 -69 c106 -54 118 -63 107 -77 -22 -28 -352 -427 -358 -432 -3 -3 -24 -27 -46 -55 -22 -27 -118 -143 -212 -257 l-172 -207 -58 27 c-112 54 -467 234 -475 241 -6 6 224 299 347 441 11 14 50 60 84 103 35 42 65 77 66 77 2 0 23 -26 47 -57 45 -61 157 -193 174 -205 5 -4 15 -8 21 -8 25 0 211 244 299 393 26 42 49 77 51 77 3 0 59 -27 125 -61z m659 35 c0 -5 -75 -100 -90 -114 -6 -5 -498 -597 -608 -731 -60 -73 -65 -77 -130 -94 -69 -18 -142 -37 -272 -73 -41 -11 -92 -24 -114 -28 l-39 -7 78 94 c43 52 108 130 144 174 36 43 169 203 295 355 125 151 234 283 240 292 8 11 90 36 246 76 261 67 250 64 250 56z" />
                                <path d="M2465 4077 c-56 -19 -81 -33 -127 -75 -158 -142 -116 -403 81 -499 46 -23 69 -28 131 -28 95 1 162 29 223 94 181 193 57 501 -208 517 -33 2 -78 -2 -100 -9z m206 -83 c112 -61 159 -202 105 -315 -22 -48 -81 -107 -126 -126 -53 -24 -156 -21 -205 4 -142 74 -188 248 -98 365 82 106 210 134 324 72z" />
                                <path d="M988 1674 c-16 -5 -18 -24 -18 -220 l0 -214 35 0 35 0 0 85 0 85 58 0 c84 1 133 15 163 48 37 41 45 94 22 139 -31 63 -57 75 -174 79 -57 1 -112 1 -121 -2z m207 -68 c20 -13 25 -25 25 -60 0 -62 -21 -77 -107 -79 l-68 -2 -3 69 c-4 98 -3 100 69 93 33 -3 71 -12 84 -21z" />
                                <path d="M1537 1672 c-30 -3 -40 -9 -48 -30 -17 -43 -78 -209 -114 -310 l-33 -93 36 3 c36 3 38 5 61 71 l23 67 83 0 c92 0 79 11 118 -95 13 -35 19 -40 51 -43 20 -2 36 -1 36 1 0 5 -42 124 -80 227 -18 47 -41 111 -52 142 -22 62 -26 65 -81 60z m43 -147 c4 -11 13 -33 19 -48 18 -44 15 -47 -55 -47 -59 0 -65 2 -59 18 3 9 18 52 32 96 l26 78 15 -38 c7 -22 17 -48 22 -59z" />
                                <path d="M1863 1673 l-23 -4 0 -215 0 -214 150 0 150 0 0 30 0 30 -115 0 -115 0 -2 173 c0 94 -2 178 -2 186 -1 17 -12 20 -43 14z" />
                                <path d="M2247 1673 c-16 -4 -17 -21 -15 -216 l3 -212 30 0 30 0 3 180 3 180 25 -45 c14 -25 43 -76 64 -115 21 -38 54 -97 74 -129 20 -33 36 -63 36 -68 0 -4 23 -8 50 -8 l50 0 0 214 c0 126 -4 217 -10 221 -5 3 -21 3 -35 -1 l-25 -6 0 -172 0 -171 -38 65 c-21 36 -52 90 -69 120 -75 135 -87 152 -110 161 -25 9 -36 10 -66 2z" />
                                <path d="M2834 1669 c-39 -11 -95 -67 -110 -111 -18 -48 -17 -152 2 -196 34 -82 99 -122 198 -122 82 1 137 26 173 81 24 37 28 54 31 129 5 121 -24 179 -111 215 -39 16 -133 19 -183 4z m163 -59 c41 -25 63 -77 63 -150 0 -106 -38 -160 -118 -168 -70 -6 -115 17 -141 74 -41 85 -16 214 47 249 39 21 111 19 149 -5z" />
                                <path d="M3809 1674 c-10 -3 -37 -62 -73 -162 -32 -86 -66 -179 -77 -206 -25 -64 -25 -66 16 -66 25 0 37 5 41 18 3 9 15 41 26 70 l20 52 83 0 83 0 23 -67 c24 -67 25 -68 63 -71 34 -3 38 -1 31 15 -4 10 -39 104 -77 208 -39 105 -73 193 -77 196 -9 10 -63 18 -82 13z m70 -155 l29 -84 -60 -3 c-33 -2 -62 -1 -65 1 -4 5 42 151 54 170 8 13 11 7 42 -84z" />
                                <path d="M3210 1643 c4 -15 22 -66 40 -113 17 -47 38 -103 45 -125 8 -22 25 -67 38 -100 l23 -60 43 0 c40 0 44 2 56 35 7 19 28 73 45 120 18 46 47 126 66 177 l33 93 -37 0 -37 0 -60 -180 c-33 -98 -62 -179 -65 -180 -3 0 -22 53 -43 118 -79 238 -78 237 -119 240 -36 3 -37 3 -28 -25z" />
                            </g>
                        </svg>
                        <h1 className="logo-text" style={{ color: 'white', margin: 0, padding: 0, fontWeight: '800', letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>PALNOVAA</h1>
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
