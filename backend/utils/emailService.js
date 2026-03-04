const { Resend } = require('resend');

let resendClient = null;

const getResendClient = () => {
    if (resendClient) return resendClient;

    if (process.env.RESEND_API_KEY) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
        return resendClient;
    }

    console.log('⚠️ No RESEND_API_KEY found. Using fallback mock.');
    return null;
};

const sendOtpEmail = async (to, otpCode) => {
    try {
        const client = getResendClient();

        if (!client) {
            console.log('🔑 ⚠️ (TEST MODE) OTP Code is:', otpCode);
            return false; // Will trigger the UI fallback
        }

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; direction: rtl; text-align: right;">
                <h2 style="color: #4A90E2;">PalNova Verification</h2>
                <p>مرحباً،</p>
                <p>رمز الدخول الخاص بك هو:</p>
                <h1 style="background-color: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px; border-radius: 5px; font-family: monospace;">${otpCode}</h1>
                <p>هذا الرمز صالح لمدة 5 دقائق.</p>
            </div>
        `;

        const { data, error } = await client.emails.send({
            from: 'PalNova Security <onboarding@resend.dev>', // resend.dev is the default testing domain provided by Resend
            to: [to],
            subject: 'PalNova - رمز التحقق الخاص بك',
            html: emailHtml,
        });

        if (error) {
            console.error('❌ Error from Resend API:', error);
            console.log('🔑 OTP Code (Fallback):', otpCode);
            return false;
        }

        console.log('📨 Message sent successfully via Resend. ID:', data.id);
        return true;

    } catch (error) {
        console.error('❌ Fatal error sending email via Resend:', error.message);
        console.log('🔑 OTP Code (Fallback):', otpCode);
        return false;
    }
};

module.exports = { sendOtpEmail };
