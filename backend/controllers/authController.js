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
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        let { username, email, password, full_name, date_of_birth, gender } = req.body;

        // Convert empty strings to null for PostgreSQL compatibility
        if (date_of_birth === '') date_of_birth = null;
        if (gender === '') gender = null;
        if (full_name === '') full_name = null;

        // التحقق من وجود المستخدم
        const userExists = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (userExists.rows.length > 0) {
            const field = userExists.rows[0].email === email ? 'البريد الإلكتروني' : 'اسم المستخدم';
            return res.status(400).json({ error: `${field} مسجل مسبقاً` });
        }

        // تشفير كلمة المرور
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // إنشاء كود التحقق (متوافق مع كل نسخ Node)
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 5 * 60000); // صالح لمدة 5 دقائق

        // إضافة المستخدم (تم تجعله مفعل افتراضياً مؤقتاً لتخطي الإيميل)
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, full_name, date_of_birth, gender, otp_code, otp_expires_at, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE) 
       RETURNING id, username, email, full_name, bio, profile_picture, role`,
            [username, email, password_hash, full_name, date_of_birth, gender, otpCode, otpExpiresAt]
        );

        const user = result.rows[0];

        // ⚠️ تم إيقاف إرسال الإيميل مؤقتاً بناءً على طلبك
        // const emailSent = await sendOtpEmail(user.email, otpCode);

        // إنشاء Token للدخول المباشر
        const secret = process.env.JWT_SECRET || 'fallback_secret_for_emergency_debugging';
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role || 'user'
            },
            secret,
            { expiresIn: '7d' }
        );

        // الرد بالدخول المباشر (تجاوز شاشة الكود)
        res.status(201).json({
            message: 'تم التسجيل بنجاح! جاري الدخول...',
            requireOtp: false,
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
        console.error('Register error details:', error);
        res.status(500).json({ error: `خطأ في التسجيل: ${error.message || 'حدث خطأ غير متوقع'}` });
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
            return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
        }

        // البحث عن المستخدم
        const result = await pool.query(
            'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        const user = result.rows[0];

        // التحقق من القفل المؤقت
        if (user.lock_until && new Date(user.lock_until) > new Date()) {
            const waitMinutes = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
            return res.status(403).json({
                error: `الحساب مقفل مؤقتاً. يرجى المحاولة بعد ${waitMinutes} دقيقة.`
            });
        }

        // التحقق من كلمة المرور
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        // التحقق من أن الحساب نشط
        // التحقق من أن الحساب نشط
        if (!user.is_active && user.is_active !== undefined) {
            return res.status(403).json({ error: 'الحساب معطل. يرجى التواصل مع الدعم الفني.' });
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
            message: emailSent
                ? 'Verification code sent to your email'
                : `فشل الإرسال (حظر من السيرفر). كود الدخول المؤقت هو: ${otpCode}`
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


/**
 * طلب إعادة تعيين كلمة المرور (نسيت كلمة المرور)
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // البحث عن المستخدم
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            // لا نخبر المستخدم أن البريد غير موجود لأسباب أمنية
            return res.json({ message: 'If the email exists, a verification code has been sent.' });
        }

        const user = result.rows[0];

        // إنشاء كود التحقق
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60000); // صالح لمدة 10 دقائق

        // حفظ الكود في قاعدة البيانات
        await pool.query(
            `UPDATE users 
             SET otp_code = $1, otp_expires_at = $2, otp_attempts = 0 
             WHERE id = $3`,
            [otpCode, otpExpiresAt, user.id]
        );

        // إرسال كود التحقق عبر البريد الإلكتروني
        // نفترض أن sendOtpEmail يمكن استخدامه هنا أيضاً، أو يمكن تعديل الرسالة لاحقاً
        const emailSent = await sendOtpEmail(user.email, otpCode);

        if (!emailSent) {
            console.log(`⚠️ Email failed (Check .env). OTP for ${user.email}: ${otpCode}`);
        }

        res.json({
            message: emailSent
                ? 'If the email exists, a verification code has been sent.'
                : `فشل الإرسال (حظر من السيرفر). كود الدخول المؤقت هو: ${otpCode}`,
            email: user.email
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error request password reset' });
    }
};

/**
 * إعادة تعيين كلمة المرور
 */
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // البحث عن المستخدم
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const user = result.rows[0];

        // التحقق من صحة الكود والصلاحية
        const isValid = user.otp_code === otp;
        const isExpired = new Date() > new Date(user.otp_expires_at);

        if (!isValid || isExpired) {
            // زيادة عدد المحاولات الفاشلة
            const attempts = (user.otp_attempts || 0) + 1;
            await pool.query('UPDATE users SET otp_attempts = $1 WHERE id = $2', [attempts, user.id]);

            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        // تشفير كلمة المرور الجديدة
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(newPassword, saltRounds);

        // تحديث كلمة المرور ومسح الكود
        await pool.query(
            `UPDATE users 
             SET password_hash = $1, otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0 
             WHERE id = $2`,
            [password_hash, user.id]
        );

        res.json({ message: 'Password reset successfully. You can now login.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error during password reset' });
    }
};

module.exports = { register, login, verifyOtp, getMe, logout, updateLocation, forgotPassword, resetPassword };
