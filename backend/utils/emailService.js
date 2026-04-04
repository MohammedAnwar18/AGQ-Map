const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ===== قالب الإيميل الاحترافي لـ PalNovaa =====
const buildOtpEmailHtml = (otpCode) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e293b;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:40px 30px;text-align:center;border-bottom:3px solid #fbab15;">
              <img
                src="https://pub-6e55680fed9e448b82ffe80f9d92b020.r2.dev/logo.png"
                alt="PalNovaa"
                width="80"
                height="80"
                style="border-radius:16px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"
                onerror="this.style.display='none'"
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
                    <div style="background:linear-gradient(135deg,#0f172a,#1a2540);border:2px solid #fbab15;border-radius:16px;padding:30px 20px;display:inline-block;">
                      <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;letter-spacing:1px;">رمز التحقق</p>
                      <p style="margin:0;font-size:48px;font-weight:900;color:#fbab15;letter-spacing:18px;font-family:'Courier New',monospace;">${otpCode}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- COUNTDOWN WARNING -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:rgba(251,171,21,0.1);border:1px solid rgba(251,171,21,0.3);border-radius:10px;padding:14px 18px;">
                    <p style="margin:0;color:#fcd34d;font-size:13px;">
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

// ===== إرسال رمز التحقق OTP =====
const sendOtpEmail = async (to, otpCode) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'PalNovaa <onboarding@resend.dev>',
            to: [to],
            subject: '🔐 PalNovaa — رمز التحقق الخاص بك',
            html: buildOtpEmailHtml(otpCode),
        });

        if (error) {
            console.error('❌ Resend API error:', error);
            console.log('📋 OTP Fallback:', otpCode);
            return false;
        }

        console.log('✅ Email sent via Resend:', data?.id);
        return true;

    } catch (err) {
        console.error('❌ Unexpected error sending email:', err.message);
        console.log('📋 OTP Fallback:', otpCode);
        return false;
    }
};

module.exports = { sendOtpEmail };

