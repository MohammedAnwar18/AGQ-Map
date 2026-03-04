const nodemailer = require('nodemailer');

let transporter;

const createTransporter = async () => {
    if (transporter) return transporter;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 10000, // 10 seconds timeout
            greetingTimeout: 10000,
            socketTimeout: 10000
        });
        return transporter;
    } else {
        console.log('⚠️ No real email config found. Skipping Ethereal (prevent timeout on Render).');
        // Return a dummy transporter that just resolves
        return {
            sendMail: async (mailOptions) => {
                console.log('Mock email sent to:', mailOptions.to);
                return { messageId: 'mock-id-123' };
            }
        };
    }
};

const sendOtpEmail = async (to, otpCode) => {
    try {
        const mailTransporter = await createTransporter();
        if (!mailTransporter) return false;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"PalNova Security" <noreply@palnova.com>',
            to: to,
            subject: 'PalNova - رمز التحقق الخاص بك',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; direction: rtl; text-align: right;">
                    <h2 style="color: #4A90E2;">PalNova Verification</h2>
                    <p>مرحباً،</p>
                    <p>رمز الدخول الخاص بك هو:</p>
                    <h1 style="background-color: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px; border-radius: 5px; font-family: monospace;">${otpCode}</h1>
                    <p>هذا الرمز صالح لمدة 5 دقائق.</p>
                </div>
            `
        };

        const sendPromise = mailTransporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Email sending timed out (Render SMTP port restriction)')), 4000)
        );

        const info = await Promise.race([sendPromise, timeoutPromise]);
        console.log('📨 Message sent: %s', info.messageId);

        if (!process.env.EMAIL_PASS) {
            console.log('🔑 ⚠️ (TEST MODE) OTP Code is:', otpCode);
        }

        return true;
    } catch (error) {
        console.error('❌ Error sending email (or timed out):', error.message);
        // Fallback for dev: return false so the controller knows it failed
        console.log('🔑 OTP Code (Fallback):', otpCode);
        return false;
    }
};

module.exports = { sendOtpEmail };
