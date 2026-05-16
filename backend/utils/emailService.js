const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// تهيئة Resend (إذا كان المفتاح موجوداً)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// تهيئة Nodemailer (إذا كانت إعدادات SMTP موجودة)
const transporter = process.env.EMAIL_SERVICE ? nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
}) : null;

// ===== قالب الإيميل الاحترافي لـ PalNovaa =====
const buildOtpEmailHtml = (otpCode) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    @media only screen and (max-width: 600px) {
      .inner-body { width: 100% !important; }
      .otp-box { font-size: 36px !important; letter-spacing: 10px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Tajawal',Arial,sans-serif;direction:rtl;text-align:right;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table class="inner-body" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e293b;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:40px 30px;text-align:center;border-bottom:3px solid #fbab15;">
              <img
                src="https://palnovaa.com/logo.png"
                alt="PalNovaa"
                width="80"
                height="80"
                style="border-radius:16px;margin-bottom:16px;display:inline-block;border:2px solid #fbab15;"
              />
              <h1 style="margin:0;color:#fbab15;font-size:32px;letter-spacing:2px;font-weight:800;">PalNovaa</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">الشبكة الاجتماعية المكانية الذكية</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 40px 30px;text-align:right;">
              <h2 style="color:#f8fafc;font-size:22px;margin:0 0 16px;">رمز التحقق الخاص بك</h2>
              <p style="color:#94a3b8;font-size:15px;line-height:1.8;margin:0 0 30px;">
                مرحباً 👋<br/>
                لقد طلبت رمز التحقق لتفعيل أو استعادة حساب PalNovaa الخاص بك.<br/>
                استخدم الرمز التالي لإتمام العملية:
              </p>

              <!-- OTP BOX -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
                <tr>
                  <td align="center">
                    <div style="background:linear-gradient(135deg,#0f172a,#1a2540);border:2px solid #fbab15;border-radius:16px;padding:30px 20px;display:inline-block;min-width:200px;">
                      <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;letter-spacing:1px;text-align:center;">رمز التحقق</p>
                      <p class="otp-box" style="margin:0;font-size:48px;font-weight:900;color:#fbab15;letter-spacing:18px;font-family:monospace;text-align:center;">${otpCode}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- COUNTDOWN WARNING -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:rgba(251,171,21,0.1);border:1px solid rgba(251,171,21,0.3);border-radius:10px;padding:14px 18px;">
                    <p style="margin:0;color:#fcd34d;font-size:13px;text-align:center;">
                      ⏱ هذا الرمز صالح لمدة <strong>5 دقائق فقط</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="color:#64748b;font-size:13px;line-height:1.7;">
                إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة. لن يتم إجراء أي تغيير على حسابك.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#0f172a;padding:24px 40px;text-align:center;border-top:1px solid #334155;">
              <p style="margin:0 0 6px;color:#64748b;font-size:12px;">
                &copy; ${new Date().getFullYear()} PalNovaa — جميع الحقوق محفوظة
              </p>
              <p style="margin:0;color:#475569;font-size:11px;">
                هذا البريد تم إرساله تلقائياً، يرجى عدم الرد عليه.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// نص بديل للإيميل (هام جداً لتقليل احتمالية اعتباره سبام)
const buildOtpEmailText = (otpCode) => `
مرحباً،

رمز التحقق الخاص بك لـ PalNovaa هو: ${otpCode}

هذا الرمز صالح لمدة 5 دقائق فقط.

إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.

شكراً لك،
فريق PalNovaa
`;

/**
 * إرسال رمز التحقق OTP
 * تحاول الدالة استخدام Nodemailer أولاً (إذا تم إعداده) ثم Resend كبديل
 */
const sendOtpEmail = async (to, otpCode) => {
    const subject = 'PalNovaa - رمز التحقق الخاص بك';
    const htmlContent = buildOtpEmailHtml(otpCode);
    const textContent = buildOtpEmailText(otpCode);
    const fromName = 'PalNovaa Security';
    
    // ملاحظة: سجلات الـ DNS الخاصة بك موثقة على palnovaa.com
    const authenticatedDomain = process.env.RESEND_DOMAIN || 'palnovaa.com';
    const fromEmail = process.env.EMAIL_USER || `noreply@${authenticatedDomain}`;

    // 1. محاولة الإرسال عبر Nodemailer (SMTP) إذا كان مفعلاً
    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to,
                subject,
                text: textContent,
                html: htmlContent,
                headers: {
                    'X-Priority': '1',
                    'X-MSMail-Priority': 'High',
                    'Importance': 'high',
                    'Precedence': 'bulk'
                }
            });
            console.log('✅ Email sent via Nodemailer (SMTP)');
            return true;
        } catch (err) {
            console.error('❌ Nodemailer error:', err.message);
        }
    }

    // 2. محاولة الإرسال عبر Resend
    if (resend) {
        try {
            const resendFrom = process.env.RESEND_FROM || `noreply@${authenticatedDomain}`;
            const { data, error } = await resend.emails.send({
                from: `${fromName} <${resendFrom}>`,
                to: [to],
                subject: subject,
                text: textContent,
                html: htmlContent,
                // إضافة Header يمنع التصنيف كـ Spam في بعض الأنظمة
                headers: {
                    'Precedence': 'bulk',
                    'X-Entity-Ref-ID': Date.now().toString()
                }
            });

            if (error) {
                console.error('❌ Resend API error:', error);
                return false;
            }

            console.log('✅ Email sent via Resend:', data?.id);
            return true;

        } catch (err) {
            console.error('❌ Resend unexpected error:', err.message);
            return false;
        }
    }

    console.error('❌ No email provider configured (Set EMAIL_USER/PASS or RESEND_API_KEY)');
    console.log('📋 OTP Fallback:', otpCode);
    return false;
};

module.exports = { sendOtpEmail };


