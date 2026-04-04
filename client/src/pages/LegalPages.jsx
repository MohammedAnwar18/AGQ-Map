import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LegalPages.css';

const LegalPages = ({ type }) => {
    const navigate = useNavigate();

    const content = {
        terms: {
            title: "شروط الخدمة (Terms of Service)",
            lastUpdated: "آخر تحديث: 22 مارس 2026",
            sections: [
                {
                    header: "1. قبول الشروط",
                    body: "باستخدامك لمنصة بالنوفا (PalNovaa)، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام التطبيق."
                },
                {
                    header: "2. عمر المستخدم",
                    body: "يجب أن لا يقل عمر المستخدم عن 13 عاماً لإنشاء حساب في بالنوفا. نحن نحرص على توفير بيئة آمنة لجميع الأعمار المناسبة."
                },
                {
                    header: "3. معايير المحتوى والسلوك المقبول",
                    body: "أنت المسؤول القانوني الوحيد عن جميع المحتويات التي تقوم بنشرها. يمنع منعاً باتاً نشر أي محتوى يتضمن إيحاءات جنسية، مواد إباحية، أو محتوى يحرض على العنصرية والتمييز، أو أي ممارسات تندرج تحت الفساد الأخلاقي. يحق للإدارة تعليق أو حذف أي حساب يخالف هذه المعايير دون سابق إنذار لضمان بيئة مجتمعية نقية."
                },
                {
                    header: "4. البيانات الجغرافية",
                    body: "بالنوفا هي منصة قائمة على الموقع الجغرافي. أنت توافق على معالجة إحداثيات موقعك لعرضها على الخريطة ومشاركتها مع أصدقائك وفقاً لإعدادات الخصوصية التي تختارها."
                },
                {
                    header: "5. إخلاء المسؤولية",
                    body: "يتم توفير الخدمة 'كما هي'. بالنوفا لا تضمن دقة المواقع الجغرافية بنسبة 100% ولا ينبغي استخدامها في حالات الطوارئ الحساسة."
                }
            ]
        },
        privacy: {
            title: "سياسة الخصوصية (Privacy Policy)",
            lastUpdated: "آخر تحديث: 22 مارس 2026",
            sections: [
                {
                    header: "1. المعلومات التي نجمعها",
                    body: "نجمع معلومات الحساب الأساسية (اسم المستخدم، البريد الإلكتروني، تاريخ الميلاد، والجنس) لتشغيل حسابك وتوفير ميزاتنا."
                },
                {
                    header: "2. بيانات الموقع الجغرافي",
                    body: "نقوم بجمع إحداثيات موقعك الجغرافي (خط الطول وخط العرض) لعرض موقعك على الخريطة وتمكينك من اكتشاف المحلات والمجتمعات من حولك. لا يتم مشاركة موقعك المباشر مع الأصدقاء إلا إذا قمت بتفعيل خاصية 'مشاركة الموقع' يدوياً."
                },
                {
                    header: "3. كيف نستخدم معلوماتك",
                    body: "نستخدم بياناتك لتخصيص تجربة الخريطة، تحسين أداء التطبيق، والتأكد من أمان حسابك من خلال أنظمة التحقق (OTP)."
                },
                {
                    header: "4. التشفير وحماية البيانات",
                    body: "نستخدم أقوى بروتوكولات التشفير العالمية لحماية بياناتك. جميع الصور، المنشورات، وإحداثيات الموقع مشفرة بالكامل (Encrypted)؛ حيث يتم عزلها في قواعد بيانات، ولا يمكن لأي طرف ثالث أو حتى الموظفين غير المخولين الوصول إلى محتواك الخاص."
                },
                {
                    header: "5. حقوقك",
                    body: "لك الحق في تعديل بيانات ملفك الشخصي أو طلب حذف حسابك نهائياً في أي وقت من خلال إعدادات التطبيق."
                }
            ]
        }
    };

    const currentContent = type === 'terms' ? content.terms : content.privacy;

    return (
        <div className="legal-container legal-fade-in">
            <div className="legal-background">
                <div className="gradient-orb orb-1"></div>
            </div>
            
            <div className="legal-content glass">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    العودة
                </button>

                <header className="legal-header">
                    <h1>{currentContent.title}</h1>
                    <p className="last-updated">{currentContent.lastUpdated}</p>
                </header>

                <div className="legal-body">
                    {currentContent.sections.map((section, index) => (
                        <section key={index} className="legal-section">
                            <h2>{section.header}</h2>
                            <p>{section.body}</p>
                        </section>
                    ))}
                </div>

                <footer className="legal-footer">
                    <p>&copy; {new Date().getFullYear()} PalNovaa. جميع الحقوق محفوظة.</p>
                </footer>
            </div>
        </div>
    );
};

export default LegalPages;
