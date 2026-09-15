const {
    parsePhoneNumberFromString,
    getCountryCallingCode,
    getExampleNumber,
    isSupportedCountry
} = require('libphonenumber-js/max');
const axios = require('axios');

/**
 * Phone Intelligence Controller
 * تحليل أرقام الهواتف واستخراج معلومات OSINT عامة
 */

// ═══════════════════════════════════════════════════════════════
// Helper: منطقة الرقم من الكود الدولي
// ═══════════════════════════════════════════════════════════════
const COUNTRY_NAMES = {
    PS: 'فلسطين', IL: 'إسرائيل', JO: 'الأردن', SA: 'السعودية',
    AE: 'الإمارات', EG: 'مصر', LB: 'لبنان', SY: 'سوريا',
    IQ: 'العراق', KW: 'الكويت', BH: 'البحرين', QA: 'قطر',
    OM: 'عُمان', YE: 'اليمن', LY: 'ليبيا', TN: 'تونس',
    DZ: 'الجزائر', MA: 'المغرب', SD: 'السودان', MR: 'موريتانيا',
    US: 'الولايات المتحدة', GB: 'المملكة المتحدة', DE: 'ألمانيا',
    FR: 'فرنسا', TR: 'تركيا', IN: 'الهند', CN: 'الصين',
    RU: 'روسيا', BR: 'البرازيل', CA: 'كندا', AU: 'أستراليا',
    IT: 'إيطاليا', ES: 'إسبانيا', NL: 'هولندا', SE: 'السويد',
    JP: 'اليابان', KR: 'كوريا الجنوبية', PK: 'باكستان', BD: 'بنغلاديش',
    MY: 'ماليزيا', ID: 'إندونيسيا', TH: 'تايلاند', PH: 'الفلبين',
    NG: 'نيجيريا', ZA: 'جنوب أفريقيا', KE: 'كينيا', GH: 'غانا'
};

const CARRIER_DB = {
    PS: {
        '59': 'Jawwal', '56': 'Ooredoo Palestine',
        '57': 'Jawwal', '58': 'Jawwal',
        '69': 'Ooredoo Palestine', '68': 'Ooredoo Palestine'
    },
    JO: {
        '77': 'Orange Jordan', '78': 'Zain Jordan',
        '79': 'Umniah', '75': 'Zain Jordan'
    },
    SA: {
        '50': 'STC', '53': 'STC', '54': 'Mobily',
        '55': 'STC', '56': 'Mobily', '58': 'Zain KSA',
        '51': 'STC', '59': 'Zain KSA'
    },
    AE: {
        '50': 'du', '52': 'du', '54': 'du',
        '55': 'Etisalat', '56': 'Etisalat', '58': 'du'
    },
    EG: {
        '10': 'Vodafone Egypt', '11': 'Etisalat Egypt',
        '12': 'Orange Egypt', '15': 'WE Egypt'
    }
};

const REGION_MAP = {
    PS: { region: 'الشرق الأوسط', subregion: 'فلسطين المحتلة' },
    JO: { region: 'الشرق الأوسط', subregion: 'المشرق العربي' },
    SA: { region: 'الشرق الأوسط', subregion: 'شبه الجزيرة العربية' },
    AE: { region: 'الشرق الأوسط', subregion: 'الخليج العربي' },
    EG: { region: 'شمال أفريقيا', subregion: 'وادي النيل' },
    US: { region: 'أمريكا الشمالية', subregion: 'الولايات المتحدة' },
    GB: { region: 'أوروبا', subregion: 'الجزر البريطانية' },
    TR: { region: 'أوروبا / آسيا', subregion: 'الأناضول' },
    LB: { region: 'الشرق الأوسط', subregion: 'المشرق العربي' },
    SY: { region: 'الشرق الأوسط', subregion: 'المشرق العربي' },
    IQ: { region: 'الشرق الأوسط', subregion: 'بلاد الرافدين' },
    KW: { region: 'الشرق الأوسط', subregion: 'الخليج العربي' },
    BH: { region: 'الشرق الأوسط', subregion: 'الخليج العربي' },
    QA: { region: 'الشرق الأوسط', subregion: 'الخليج العربي' },
    OM: { region: 'الشرق الأوسط', subregion: 'شبه الجزيرة العربية' },
};

// ═══════════════════════════════════════════════════════════════
// Helper: تحديد شركة الاتصالات من بادئة الرقم
// ═══════════════════════════════════════════════════════════════
function detectCarrier(countryCode, nationalNumber) {
    const countryCarriers = CARRIER_DB[countryCode];
    if (!countryCarriers) return null;

    // جرب أول 2 أو 3 أرقام من الرقم الوطني
    const prefix2 = nationalNumber.substring(0, 2);
    const prefix3 = nationalNumber.substring(0, 3);

    return countryCarriers[prefix3] || countryCarriers[prefix2] || null;
}

// ═══════════════════════════════════════════════════════════════
// Helper: تحديد نوع الرقم
// ═══════════════════════════════════════════════════════════════
function getNumberTypeArabic(type) {
    const types = {
        'MOBILE': 'هاتف محمول 📱',
        'FIXED_LINE': 'خط أرضي 📞',
        'FIXED_LINE_OR_MOBILE': 'أرضي أو محمول 📞📱',
        'TOLL_FREE': 'رقم مجاني ☎️',
        'PREMIUM_RATE': 'رقم مدفوع 💰',
        'SHARED_COST': 'تكلفة مشتركة 🔄',
        'VOIP': 'إنترنت VoIP 🌐',
        'PERSONAL_NUMBER': 'رقم شخصي 👤',
        'PAGER': 'بيجر 📟',
        'UAN': 'رقم وصول موحد 🏢',
        'VOICEMAIL': 'بريد صوتي 📩'
    };
    return types[type] || 'غير محدد ❓';
}

// ═══════════════════════════════════════════════════════════════
// Google Custom Search — بحث عن ظهور الرقم في الويب
// ═══════════════════════════════════════════════════════════════
async function searchWebForPhone(phoneNumber) {
    const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_CX;

    if (!googleApiKey || !googleCx) {
        return { available: false, reason: 'Google Search API غير مُهيأ' };
    }

    try {
        const queries = [
            `"${phoneNumber}"`,
            `"${phoneNumber}" site:facebook.com OR site:linkedin.com OR site:twitter.com`,
        ];

        const allResults = [];

        for (const q of queries) {
            try {
                const resp = await axios.get('https://www.googleapis.com/customsearch/v1', {
                    params: { key: googleApiKey, cx: googleCx, q, num: 10 },
                    timeout: 10000
                });

                if (resp.data.items) {
                    for (const item of resp.data.items) {
                        allResults.push({
                            title: item.title,
                            link: item.link,
                            snippet: item.snippet,
                            domain: new URL(item.link).hostname,
                            displayLink: item.displayLink,
                            datePublished: item.pagemap?.metatags?.[0]?.['article:published_time'] || null
                        });
                    }
                }
            } catch (e) {
                // تجاهل أخطاء البحث الفردي
            }
        }

        // إزالة التكرارات
        const unique = [];
        const seenLinks = new Set();
        for (const r of allResults) {
            if (!seenLinks.has(r.link)) {
                seenLinks.add(r.link);
                unique.push(r);
            }
        }

        return { available: true, results: unique, count: unique.length };
    } catch (error) {
        return { available: false, reason: error.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// NumVerify API — معلومات إضافية عن الرقم
// ═══════════════════════════════════════════════════════════════
async function queryNumVerify(phoneNumber) {
    const apiKey = process.env.NUMVERIFY_API_KEY;
    if (!apiKey) {
        return { available: false, reason: 'NumVerify API غير مُهيأ' };
    }

    try {
        const resp = await axios.get('http://apilayer.net/api/validate', {
            params: { access_key: apiKey, number: phoneNumber, format: 1 },
            timeout: 10000
        });

        if (resp.data && resp.data.valid !== undefined) {
            return {
                available: true,
                data: {
                    valid: resp.data.valid,
                    localFormat: resp.data.local_format,
                    internationalFormat: resp.data.international_format,
                    countryPrefix: resp.data.country_prefix,
                    countryCode: resp.data.country_code,
                    countryName: resp.data.country_name,
                    location: resp.data.location,
                    carrier: resp.data.carrier,
                    lineType: resp.data.line_type
                }
            };
        }

        return { available: false, reason: 'لم يتم العثور على بيانات' };
    } catch (error) {
        return { available: false, reason: error.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// Spam Check — فحص بلاغات الرقم
// ═══════════════════════════════════════════════════════════════
async function checkSpamReports(phoneNumber) {
    const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_CX;

    if (!googleApiKey || !googleCx) {
        return { available: false, reports: [], riskLevel: 'unknown' };
    }

    try {
        const spamQuery = `"${phoneNumber}" spam OR scam OR احتيال OR نصب OR مزعج`;
        const resp = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: { key: googleApiKey, cx: googleCx, q: spamQuery, num: 10 },
            timeout: 10000
        });

        const reports = [];
        if (resp.data.items) {
            for (const item of resp.data.items) {
                reports.push({
                    source: item.displayLink,
                    title: item.title,
                    link: item.link,
                    snippet: item.snippet,
                    date: item.pagemap?.metatags?.[0]?.['article:published_time'] || null
                });
            }
        }

        let riskLevel = 'low';
        if (reports.length >= 5) riskLevel = 'high';
        else if (reports.length >= 2) riskLevel = 'medium';
        else if (reports.length >= 1) riskLevel = 'low-medium';

        return { available: true, reports, count: reports.length, riskLevel };
    } catch (error) {
        return { available: false, reports: [], riskLevel: 'unknown' };
    }
}

// ═══════════════════════════════════════════════════════════════
// بناء شبكة العلاقات
// ═══════════════════════════════════════════════════════════════
function buildRelationshipNetwork(phoneNumber, localData, webResults, spamData) {
    const nodes = [
        { id: 'phone', type: 'phone', label: phoneNumber, primary: true }
    ];
    const edges = [];
    const seenDomains = new Set();

    // إضافة عقدة البلد
    if (localData.country) {
        nodes.push({ id: 'country', type: 'location', label: localData.countryNameAr || localData.country });
        edges.push({ from: 'phone', to: 'country', label: 'مسجل في' });
    }

    // إضافة عقدة الشركة
    if (localData.carrier) {
        nodes.push({ id: 'carrier', type: 'organization', label: localData.carrier });
        edges.push({ from: 'phone', to: 'carrier', label: 'مشغّل بواسطة' });
    }

    // إضافة عقد المواقع من نتائج البحث
    if (webResults?.available && webResults.results) {
        for (let i = 0; i < Math.min(webResults.results.length, 8); i++) {
            const r = webResults.results[i];
            const domain = r.domain;
            if (!seenDomains.has(domain)) {
                seenDomains.add(domain);
                const nodeId = `web_${i}`;
                nodes.push({ id: nodeId, type: 'website', label: domain });
                edges.push({ from: 'phone', to: nodeId, label: 'ظهر في' });

                // استخراج أسماء أنشطة تجارية محتملة
                if (r.title && !r.title.includes(phoneNumber)) {
                    const bizId = `biz_${i}`;
                    nodes.push({ id: bizId, type: 'business', label: r.title.substring(0, 40) });
                    edges.push({ from: nodeId, to: bizId, label: 'مرتبط بـ' });
                }
            }
        }
    }

    // إضافة عقد بلاغات Spam
    if (spamData?.available && spamData.reports && spamData.reports.length > 0) {
        nodes.push({ id: 'spam', type: 'warning', label: `${spamData.count} بلاغ` });
        edges.push({ from: 'phone', to: 'spam', label: 'بلاغات' });
    }

    return { nodes, edges };
}

// ═══════════════════════════════════════════════════════════════
// حساب درجة الثقة الإجمالية
// ═══════════════════════════════════════════════════════════════
function calculateConfidenceScores(localData, numverifyData, webResults, spamData) {
    const scores = [];

    // صحة الرقم — ثقة عالية من المكتبة المحلية
    scores.push({
        category: 'صحة الرقم',
        confidence: localData.isValid ? 10 : 2,
        source: 'libphonenumber (محلي)',
        icon: '✅'
    });

    // نوع الرقم
    scores.push({
        category: 'نوع الرقم',
        confidence: localData.type ? 9 : 3,
        source: 'libphonenumber (محلي)',
        icon: '📱'
    });

    // البلد والمفتاح
    scores.push({
        category: 'البلد والمفتاح',
        confidence: localData.country ? 10 : 1,
        source: 'libphonenumber (محلي)',
        icon: '🌍'
    });

    // شركة الاتصالات
    if (localData.carrier) {
        scores.push({
            category: 'شركة الاتصالات',
            confidence: numverifyData?.available ? 9 : 7,
            source: numverifyData?.available ? 'NumVerify + قاعدة بيانات محلية' : 'قاعدة بيانات محلية',
            icon: '📡'
        });
    }

    // الظهور في الويب
    if (webResults?.available) {
        scores.push({
            category: 'ظهور في مواقع عامة',
            confidence: webResults.count > 5 ? 9 : webResults.count > 0 ? 7 : 2,
            source: 'Google Custom Search',
            icon: '🔗'
        });
    }

    // بلاغات Spam
    if (spamData?.available) {
        scores.push({
            category: 'بلاغات Spam/Scam',
            confidence: spamData.count > 0 ? 8 : 5,
            source: 'بحث عام',
            icon: '🚨'
        });
    }

    // المنطقة الجغرافية
    if (localData.region) {
        scores.push({
            category: 'الموقع الجغرافي',
            confidence: 8,
            source: 'تحليل مفتاح الدولة',
            icon: '📍'
        });
    }

    return scores;
}

// ═══════════════════════════════════════════════════════════════
// الدالة الرئيسية: تحليل رقم الهاتف
// ═══════════════════════════════════════════════════════════════
const analyzePhone = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber || phoneNumber.trim().length < 4) {
            return res.status(400).json({
                error: 'يرجى إدخال رقم هاتف صالح',
                code: 'INVALID_INPUT'
            });
        }

        const cleanNumber = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

        console.log(`[Phone Intel] Analyzing: ${cleanNumber} — by admin ${req.user.id}`);

        // ─── Step 1: التحليل المحلي بـ libphonenumber ───
        let localData = {
            isValid: false,
            isPossible: false,
            type: null,
            typeArabic: null,
            country: null,
            countryNameAr: null,
            countryCallingCode: null,
            nationalNumber: null,
            carrier: null,
            region: null,
            formats: {}
        };

        const phoneObj = parsePhoneNumberFromString(cleanNumber);

        if (phoneObj) {
            const countryCode = phoneObj.country;
            const nationalNum = phoneObj.nationalNumber;

            localData = {
                isValid: phoneObj.isValid(),
                isPossible: phoneObj.isPossible(),
                type: phoneObj.getType(),
                typeArabic: getNumberTypeArabic(phoneObj.getType()),
                country: countryCode,
                countryNameAr: COUNTRY_NAMES[countryCode] || countryCode,
                countryCallingCode: phoneObj.countryCallingCode,
                nationalNumber: nationalNum,
                carrier: detectCarrier(countryCode, nationalNum),
                region: REGION_MAP[countryCode] || null,
                formats: {
                    e164: phoneObj.format('E.164'),
                    international: phoneObj.format('INTERNATIONAL'),
                    national: phoneObj.format('NATIONAL'),
                    rfc3966: phoneObj.format('RFC3966'),
                    raw: cleanNumber
                }
            };
        } else {
            // حاول مع إضافة + إذا لم يكن موجوداً
            const withPlus = cleanNumber.startsWith('+') ? cleanNumber : `+${cleanNumber}`;
            const phoneObj2 = parsePhoneNumberFromString(withPlus);

            if (phoneObj2) {
                const countryCode = phoneObj2.country;
                const nationalNum = phoneObj2.nationalNumber;

                localData = {
                    isValid: phoneObj2.isValid(),
                    isPossible: phoneObj2.isPossible(),
                    type: phoneObj2.getType(),
                    typeArabic: getNumberTypeArabic(phoneObj2.getType()),
                    country: countryCode,
                    countryNameAr: COUNTRY_NAMES[countryCode] || countryCode,
                    countryCallingCode: phoneObj2.countryCallingCode,
                    nationalNumber: nationalNum,
                    carrier: detectCarrier(countryCode, nationalNum),
                    region: REGION_MAP[countryCode] || null,
                    formats: {
                        e164: phoneObj2.format('E.164'),
                        international: phoneObj2.format('INTERNATIONAL'),
                        national: phoneObj2.format('NATIONAL'),
                        rfc3966: phoneObj2.format('RFC3966'),
                        raw: cleanNumber
                    }
                };
            }
        }

        // ─── Step 2: استعلامات خارجية (بالتوازي) ───
        const e164 = localData.formats?.e164 || cleanNumber;

        const [numverifyData, webResults, spamData] = await Promise.all([
            queryNumVerify(e164),
            searchWebForPhone(e164),
            checkSpamReports(e164)
        ]);

        // دمج بيانات الـ carrier من NumVerify إذا لم يكن لدينا
        if (!localData.carrier && numverifyData?.available && numverifyData.data?.carrier) {
            localData.carrier = numverifyData.data.carrier;
        }

        // ─── Step 3: بناء شبكة العلاقات ───
        const network = buildRelationshipNetwork(e164, localData, webResults, spamData);

        // ─── Step 4: حساب درجات الثقة ───
        const confidenceScores = calculateConfidenceScores(localData, numverifyData, webResults, spamData);

        // ─── Step 5: بناء الخط الزمني ───
        const timeline = [];
        if (webResults?.available && webResults.results) {
            for (const r of webResults.results) {
                if (r.datePublished) {
                    timeline.push({
                        date: r.datePublished,
                        source: r.domain,
                        title: r.title,
                        link: r.link,
                        type: 'web_appearance'
                    });
                }
            }
        }
        if (spamData?.available && spamData.reports) {
            for (const r of spamData.reports) {
                if (r.date) {
                    timeline.push({
                        date: r.date,
                        source: r.source,
                        title: r.title,
                        link: r.link,
                        type: 'spam_report'
                    });
                }
            }
        }
        // ترتيب زمني تنازلي
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

        // ─── Step 6: حساب Risk Score الإجمالي ───
        let overallRisk = 'منخفض';
        let riskScore = 0;
        if (spamData?.available && spamData.count > 0) riskScore += spamData.count * 15;
        if (!localData.isValid) riskScore += 30;
        if (localData.type === 'VOIP') riskScore += 20;

        if (riskScore >= 60) overallRisk = 'مرتفع 🔴';
        else if (riskScore >= 30) overallRisk = 'متوسط 🟡';
        else overallRisk = 'منخفض 🟢';

        // ─── الرد النهائي ───
        res.json({
            success: true,
            analyzedAt: new Date().toISOString(),
            phoneNumber: e164,

            // البيانات المحلية
            local: localData,

            // NumVerify
            numverify: numverifyData,

            // البحث في الويب
            webPresence: webResults,

            // بلاغات Spam
            spamReports: spamData,

            // شبكة العلاقات
            network,

            // الخط الزمني
            timeline,

            // درجات الثقة
            confidenceScores,

            // Risk Assessment
            riskAssessment: {
                score: Math.min(riskScore, 100),
                level: overallRisk,
                factors: [
                    ...(spamData?.count > 0 ? [`${spamData.count} بلاغ spam/scam`] : []),
                    ...(!localData.isValid ? ['الرقم غير صالح'] : []),
                    ...(localData.type === 'VOIP' ? ['رقم إنترنت VoIP'] : [])
                ]
            },

            // ملخص المصادر المتاحة
            dataSources: {
                libphonenumber: true,
                numverify: numverifyData?.available || false,
                googleSearch: webResults?.available || false,
                spamCheck: spamData?.available || false
            }
        });

    } catch (error) {
        console.error('[Phone Intel] Error:', error);
        res.status(500).json({
            error: 'حدث خطأ أثناء تحليل الرقم',
            details: error.message
        });
    }
};

module.exports = { analyzePhone };
