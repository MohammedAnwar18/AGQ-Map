const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const crypto = require('crypto');
const { sendOtpEmail } = require('../utils/emailService');

/**
 * تسجيل مستخدم جديد
 */
const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, full_name, date_of_birth, gender } = req.body;

        // التحقق من وجود المستخدم
        const userExists = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // تشفير كلمة المرور
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // إنشاء كود التحقق
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const otpExpiresAt = new Date(Date.now() + 5 * 60000); // صالح لمدة 5 دقائق

        // إضافة المستخدم (غير مفعل افتراضياً)
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, full_name, date_of_birth, gender, otp_code, otp_expires_at, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE) 
       RETURNING id, username, email`,
            [username, email, password_hash, full_name, date_of_birth, gender, otpCode, otpExpiresAt]
        );

        const user = result.rows[0];

        // إرسال كود التحقق
        const emailSent = await sendOtpEmail(user.email, otpCode);
        if (!emailSent) {
            console.log(`⚠️ Email failed (Check .env). OTP for ${user.email}: ${otpCode}`);
        }

        // الرد بأن مطلوب OTP
        res.status(201).json({
            message: 'Registration successful. Please verify your email.',
            requireOtp: true,
            email: user.email
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

/**
 * تسجيل الدخول
 */
/**
 * تسجيل الدخول
 */
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // البحث عن المستخدم
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // التحقق من القفل المؤقت
        if (user.lock_until && new Date(user.lock_until) > new Date()) {
            const waitMinutes = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
            return res.status(403).json({
                error: `Account temporarily locked. Please try again in ${waitMinutes} minutes.`
            });
        }

        // التحقق من كلمة المرور
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // التحقق من أن الحساب نشط
        // التحقق من أن الحساب نشط
        if (!user.is_active && user.is_active !== undefined) {
            return res.status(403).json({ error: 'Account suspended. Please contact support.' });
        }

        // === تعديل: إذا كان الحساب مفعل مسبقاً، يدخل مباشرة بدون رمز ===
        if (user.is_verified) {
            // تحديث حالة الاتصال
            await pool.query(
                `UPDATE users 
                 SET is_online = true, last_seen = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [user.id]
            );

            // إنشاء Token مباشرة
            const token = jwt.sign(
                {
                    userId: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role || 'user'
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.full_name,
                    bio: user.bio,
                    profile_picture: user.profile_picture,
                    role: user.role || 'user'
                }
            });
        }

        // === إذا لم يكن مفعل (أول مرة): أرسل رمز التحقق ===
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const otpExpiresAt = new Date(Date.now() + 5 * 60000); // صالح لمدة 5 دقائق

        // حفظ الكود في قاعدة البيانات
        await pool.query(
            `UPDATE users 
             SET otp_code = $1, otp_expires_at = $2, otp_attempts = 0 
             WHERE id = $3`,
            [otpCode, otpExpiresAt, user.id]
        );

        const { sendOtpEmail } = require('../utils/emailService');

        // إرسال كود التحقق عبر البريد الإلكتروني
        const emailSent = await sendOtpEmail(user.email, otpCode);

        if (!emailSent) {
            console.log(`⚠️ Email failed (Check .env). OTP for ${user.email}: ${otpCode}`);
        }

        // الرد بأن مطلوب OTP
        res.json({
            requireOtp: true,
            email: user.email,
            message: 'Verification code sent to your email'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

/**
 * التحقق من رمز OTP
 */
const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP required' });
        }

        // البحث عن المستخدم
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // التحقق من القفل
        if (user.lock_until && new Date(user.lock_until) > new Date()) {
            return res.status(403).json({ error: 'Account temporarily locked' });
        }

        // التحقق من صحة الكود والصلاحية
        const isValid = user.otp_code === otp;
        const isExpired = new Date() > new Date(user.otp_expires_at);

        if (!isValid || isExpired) {
            // زيادة عدد المحاولات الفاشلة
            const attempts = (user.otp_attempts || 0) + 1;
            let updateQuery = 'UPDATE users SET otp_attempts = $1 WHERE id = $2';
            let queryParams = [attempts, user.id];

            // قفل الحساب إذا تجاوز 3 محاولات
            if (attempts >= 3) {
                const lockUntil = new Date(Date.now() + 15 * 60000); // قفل لمدة 15 دقيقة
                updateQuery = 'UPDATE users SET otp_attempts = $1, lock_until = $2 WHERE id = $3';
                queryParams = [attempts, lockUntil, user.id];
            }

            await pool.query(updateQuery, queryParams);

            if (attempts >= 3) {
                return res.status(403).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
            }

            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        // الكود صحيح - تسجيل الدخول

        // تحديث حالة الاتصال ومسح الكود وتفعيل الحساب
        await pool.query(
            `UPDATE users 
             SET is_online = true, last_seen = CURRENT_TIMESTAMP, 
                 otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0, lock_until = NULL,
                 is_verified = TRUE
             WHERE id = $1`,
            [user.id]
        );

        // إنشاء JWT Token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role || 'user'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                bio: user.bio,
                profile_picture: user.profile_picture,
                role: user.role || 'user'
            }
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
};

/**
 * الحصول على معلومات المستخدم الحالي
 */
const getMe = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, full_name, bio, profile_picture, created_at, is_online, date_of_birth, role
       FROM users WHERE id = $1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * تسجيل الخروج
 */
const logout = async (req, res) => {
    try {
        await pool.query(
            'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
            [req.user.userId]
        );

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Server error during logout' });
    }
};

/**
 * تحديث موقع المستخدم
 */
const updateLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.userId;

        await pool.query(
            'UPDATE users SET last_latitude = $1, last_longitude = $2, last_seen = CURRENT_TIMESTAMP WHERE id = $3',
            [latitude, longitude, userId]
        );

        res.json({ message: 'Location updated' });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ error: 'Server error updating location' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'البريد الإلكتروني غير مسجّل' });
        }
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const otpExpiresAt = new Date(Date.now() + 15 * 60000);
        await pool.query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3', [otpCode, otpExpiresAt, email]);
        await sendOtpEmail(email, otpCode);
        return res.json({ message: 'تم إرسال رمز إعادة تعيين كلمة المرور إلى بريدك الإلكتروني' });
    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ error: 'فشل في طلب إعادة تعيين كلمة المرور' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, otp_code, new_password } = req.body;
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND otp_code = $2 AND otp_expires_at > CURRENT_TIMESTAMP', [email, otp_code]);
        if (userRes.rows.length === 0) {
            return res.status(400).json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
        }
        const password_hash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password_hash = $1, otp_code = NULL, otp_expires_at = NULL WHERE email = $2', [password_hash, email]);
        return res.json({ message: 'تم تحديث كلمة المرور بنجاح' });
    } catch (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({ error: 'فشل في إعادة تعيين كلمة المرور' });
    }
};

const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * تسجيل الدخول / إنشاء حساب عبر Google
 */
const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ error: 'رمز التحقق من جوجل مطلوب' });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: clientId,
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        if (!email) {
            return res.status(400).json({ error: 'البريد الإلكتروني غير متوفر في حساب جوجل' });
        }

        // التأكد من وجود عمود google_id في الجدول
        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)');
        } catch (e) {
            console.warn('DB alter column warning:', e.message);
        }

        // البحث عن المستخدم بحسب البريد أو google_id
        let userRes = await pool.query('SELECT * FROM users WHERE email = $1 OR google_id = $2', [email, googleId]);
        let user;

        if (userRes.rows.length === 0) {
            // حساب جديد
            let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
            if (baseUsername.length < 3) baseUsername = `user_${Date.now().toString().slice(-4)}`;
            
            let username = baseUsername;
            let userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (userCheck.rows.length > 0) {
                username = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;
            }

            const insertRes = await pool.query(
                `INSERT INTO users (username, email, full_name, profile_picture, google_id, is_online, role)
                 VALUES ($1, $2, $3, $4, $5, TRUE, 'user')
                 RETURNING id, username, email, full_name, profile_picture, role`,
                [username, email, name || username, picture || null, googleId]
            );
            user = insertRes.rows[0];
        } else {
            user = userRes.rows[0];
            // تحديث البيانات إذا لم تكن موجودة
            await pool.query(
                'UPDATE users SET google_id = COALESCE(google_id, $1), profile_picture = COALESCE(profile_picture, $2), is_online = TRUE WHERE id = $3',
                [googleId, picture, user.id]
            );
        }

        // إنشاء التوكين الخاص بالنظام JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role || 'user' },
            process.env.JWT_SECRET || 'spatial_social_network_secret_key_2024_change_in_production',
            { expiresIn: '30d' }
        );

        res.json({
            message: 'تم تسجيل الدخول عبر جوجل بنجاح',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                profile_picture: user.profile_picture || picture,
                role: user.role || 'user'
            }
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ error: 'فشل في تسجيل الدخول عبر حساب جوجل: ' + (error.message || 'خطأ في الخادم') });
    }
};

module.exports = { register, login, verifyOtp, getMe, logout, updateLocation, forgotPassword, resetPassword, googleLogin };
