const nodemailer = require('nodemailer');

/**
 * إعداد مرسل البريد الإلكتروني (Nodemailer)
 */
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : ''
    },
    tls: {
        rejectUnauthorized: false
    }
});

/**
 * إرسال رمز التحقق OTP
 */
const sendOtpEmail = async (to, otpCode) => {
    try {
        const fromName = "PalNovaa Security";
        const fromEmail = process.env.EMAIL_USER;

        const emailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; direction: rtl; text-align: right; background-color: #f9f9f9;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-top: 5px solid #fbab15;">
                    <div style="padding: 30px; text-align: center; background-color: #0f172a;">
                        <h1 style="color: #fbab15; margin: 0; font-size: 28px;">PalNovaa</h1>
                    </div>
                    <div style="padding: 40px;">
                        <h2 style="color: #1e293b; margin-top: 0;">تأكيد حسابك</h2>
                        <p style="font-size: 16px; line-height: 1.6; color: #475569;">مرحباً، شكراً لانضمامك إلى مجتمعنا. يرجى استخدام الرمز التالي لتفعيل حسابك:</p>
                        
                        <div style="background-color: #f1f5f9; padding: 25px; text-align: center; border-radius: 12px; margin: 30px 0;">
                            <span style="font-size: 36px; font-weight: bold; color: #0f172a; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace; display: block;">${otpCode}</span>
                        </div>
                        
                        <p style="font-size: 14px; color: #94a3b8;">هذا الرمز صالح لمدة 5 دقائق فقط. إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد.</p>
                    </div>
                    <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0; font-size: 12px; color: #64748b;">&copy; ${new Date().getFullYear()} PalNovaa. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject: 'PalNovaa - رمز التحقق الخاص بك',
            html: emailHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📨 Email sent successfully via Nodemailer:', info.messageId);
        return true;

    } catch (error) {
        console.error('❌ Error sending email via Nodemailer:', error.message);
        console.log('🔑 OTP Code (Fallback Log):', otpCode);
        return false;
    }
};

module.exports = { sendOtpEmail };
