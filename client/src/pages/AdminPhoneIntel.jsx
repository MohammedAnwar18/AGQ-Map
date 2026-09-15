import React, { useState, useRef } from 'react';
import { adminService } from '../services/adminApi';
import './AdminPhoneIntel.css';

// ═══════════════════════════════════════════════════════════════
// Network Graph — SVG رسم شبكة العلاقات
// ═══════════════════════════════════════════════════════════════
const NetworkGraph = ({ network }) => {
    if (!network || !network.nodes || network.nodes.length <= 1) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🕸️</div>
                <p>لا توجد بيانات كافية لبناء شبكة علاقات</p>
            </div>
        );
    }

    const width = 700;
    const height = 350;
    const cx = width / 2;
    const cy = height / 2;

    // وضع العقد بشكل دائري حول المركز
    const positions = {};
    const centerNode = network.nodes.find(n => n.primary);
    if (centerNode) {
        positions[centerNode.id] = { x: cx, y: cy };
    }

    const otherNodes = network.nodes.filter(n => !n.primary);
    const angleStep = (2 * Math.PI) / (otherNodes.length || 1);
    const radius = Math.min(width, height) * 0.35;

    otherNodes.forEach((node, i) => {
        const angle = angleStep * i - Math.PI / 2;
        positions[node.id] = {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
        };
    });

    const nodeColors = {
        phone: '#00ff88',
        location: '#00d4ff',
        organization: '#ff6b35',
        website: '#a855f7',
        business: '#f59e0b',
        warning: '#ff4444'
    };

    const nodeIcons = {
        phone: '📱', location: '📍', organization: '📡',
        website: '🌐', business: '🏢', warning: '⚠️'
    };

    return (
        <div className="pi-network">
            <svg viewBox={`0 0 ${width} ${height}`} style={{ minHeight: '350px' }}>
                {/* الحواف */}
                {network.edges.map((edge, i) => {
                    const from = positions[edge.from];
                    const to = positions[edge.to];
                    if (!from || !to) return null;
                    const midX = (from.x + to.x) / 2;
                    const midY = (from.y + to.y) / 2 - 10;
                    return (
                        <g key={`edge-${i}`}>
                            <line
                                x1={from.x} y1={from.y}
                                x2={to.x} y2={to.y}
                                className="pi-network-edge"
                                strokeDasharray="5,5"
                            />
                            <text x={midX} y={midY} className="pi-network-edge-label">
                                {edge.label}
                            </text>
                        </g>
                    );
                })}

                {/* العقد */}
                {network.nodes.map(node => {
                    const pos = positions[node.id];
                    if (!pos) return null;
                    const color = nodeColors[node.type] || '#00ff88';
                    const r = node.primary ? 28 : 18;
                    return (
                        <g key={node.id} className="pi-network-node">
                            {/* هالة متوهجة */}
                            <circle
                                cx={pos.x} cy={pos.y} r={r + 8}
                                fill={color} opacity={0.08}
                            />
                            {/* الدائرة */}
                            <circle
                                cx={pos.x} cy={pos.y} r={r}
                                fill="rgba(0,0,0,0.6)"
                                stroke={color} strokeWidth={2}
                            />
                            {/* الأيقونة */}
                            <text
                                x={pos.x} y={pos.y + 1}
                                textAnchor="middle" dominantBaseline="central"
                                fontSize={node.primary ? 16 : 12}
                            >
                                {nodeIcons[node.type] || '•'}
                            </text>
                            {/* التسمية */}
                            <text
                                x={pos.x} y={pos.y + r + 14}
                                className="pi-network-label"
                                fontSize={node.primary ? 11 : 9}
                            >
                                {node.label?.length > 25 ? node.label.substring(0, 25) + '...' : node.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// Risk Meter Component
// ═══════════════════════════════════════════════════════════════
const RiskMeter = ({ score, level }) => {
    const circumference = 2 * Math.PI * 65;
    const offset = circumference - (score / 100) * circumference;

    let color = '#00ff88';
    if (score >= 60) color = '#ff4444';
    else if (score >= 30) color = '#ff8c00';
    else if (score >= 10) color = '#ffc800';

    return (
        <div className="pi-risk-meter">
            <div className="pi-risk-circle">
                <svg viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="65" className="pi-risk-circle-bg" />
                    <circle
                        cx="70" cy="70" r="65"
                        className="pi-risk-circle-fill"
                        stroke={color}
                        strokeDashoffset={offset}
                    />
                </svg>
            </div>
            <span className="pi-risk-score" style={{ color }}>{score}</span>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
const AdminPhoneIntel = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    const handleAnalyze = async () => {
        if (!phoneNumber.trim()) {
            setError('يرجى إدخال رقم هاتف');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const data = await adminService.analyzePhone(phoneNumber.trim());
            setResult(data);
        } catch (err) {
            setError(err.response?.data?.error || 'حدث خطأ أثناء التحليل');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAnalyze();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const getConfidenceColor = (score) => {
        if (score >= 8) return '#00ff88';
        if (score >= 6) return '#00d4ff';
        if (score >= 4) return '#ffc800';
        return '#ff4444';
    };

    const exportReport = () => {
        if (!result) return;

        const report = `
╔══════════════════════════════════════════════════════════╗
║          📱 Phone Intelligence Report                    ║
║          تقرير استخبارات الهاتف                          ║
╚══════════════════════════════════════════════════════════╝

📞 الرقم: ${result.phoneNumber}
📅 تاريخ التحليل: ${new Date(result.analyzedAt).toLocaleString('ar-SA')}

═══ معلومات أساسية ═══
✅ صالح: ${result.local.isValid ? 'نعم' : 'لا'}
📱 النوع: ${result.local.typeArabic || 'غير محدد'}
🌍 البلد: ${result.local.countryNameAr || 'غير محدد'} (${result.local.country || '-'})
📡 الشركة: ${result.local.carrier || 'غير محدد'}
🔑 مفتاح الاتصال: +${result.local.countryCallingCode || '-'}

═══ صيغ الرقم ═══
E.164: ${result.local.formats?.e164 || '-'}
International: ${result.local.formats?.international || '-'}
National: ${result.local.formats?.national || '-'}
RFC3966: ${result.local.formats?.rfc3966 || '-'}

═══ المنطقة الجغرافية ═══
المنطقة: ${result.local.region?.region || 'غير محدد'}
الفرعية: ${result.local.region?.subregion || 'غير محدد'}

═══ تقييم المخاطر ═══
الدرجة: ${result.riskAssessment?.score || 0}/100
المستوى: ${result.riskAssessment?.level || 'غير محدد'}
${result.riskAssessment?.factors?.length > 0 ? 'العوامل: ' + result.riskAssessment.factors.join(', ') : ''}

═══ الظهور في الويب ═══
عدد النتائج: ${result.webPresence?.count || 0}
${result.webPresence?.results?.map(r => `  • ${r.domain}: ${r.title}`).join('\n') || 'لا توجد نتائج'}

═══ بلاغات Spam ═══
عدد البلاغات: ${result.spamReports?.count || 0}
مستوى الخطر: ${result.spamReports?.riskLevel || 'غير محدد'}

═══ درجات الثقة ═══
${result.confidenceScores?.map(s => `  ${s.icon} ${s.category}: ${s.confidence}/10 (${s.source})`).join('\n') || 'لا توجد بيانات'}

═══════════════════════════════════════
تم إنشاء التقرير بواسطة PalNovaa Phone Intelligence
`;

        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phone_intel_${result.phoneNumber?.replace(/\+/g, '')}_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="phone-intel">
            {/* Header */}
            <div className="pi-header">
                <h2>🔍 Phone Intelligence</h2>
                <p>OSINT — استخبارات الهاتف المفتوحة</p>
            </div>

            {/* Search Box */}
            <div className="pi-search-box">
                <div className="pi-input-row">
                    <div className="pi-input-wrapper">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="+970 59 XXX XXXX"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                            onKeyDown={handleKeyDown}
                            dir="ltr"
                        />
                        <span className="pi-input-icon">📞</span>
                    </div>
                    <button
                        className={`pi-analyze-btn ${loading ? 'loading' : ''}`}
                        onClick={handleAnalyze}
                        disabled={loading}
                    >
                        {loading ? '⏳ جاري التحليل...' : '🚀 تحليل'}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="pi-loading">
                    <div className="pi-loading-spinner">
                        <div className="ring"></div>
                        <div className="ring"></div>
                        <div className="ring"></div>
                    </div>
                    <div className="pi-loading-text">جاري جمع المعلومات من المصادر المتاحة...</div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="pi-error">
                    <div className="pi-error-icon">⚠️</div>
                    <div className="pi-error-text">{error}</div>
                </div>
            )}

            {/* Empty State */}
            {!loading && !result && !error && (
                <div className="pi-empty">
                    <div className="pi-empty-icon">🛡️</div>
                    <div className="pi-empty-text">أدخل رقم هاتف لبدء التحليل الأمني</div>
                    <div className="pi-empty-hint">يدعم الأرقام الدولية بصيغة +XXX أو الأرقام المحلية</div>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="pi-results">

                    {/* Summary Bar */}
                    <div className="pi-summary-bar">
                        <div className="pi-summary-item">
                            <div className="pi-summary-icon">🌍</div>
                            <div className="pi-summary-value">{result.local.countryNameAr || '—'}</div>
                            <div className="pi-summary-label">البلد</div>
                        </div>
                        <div className="pi-summary-item">
                            <div className="pi-summary-icon">{result.local.isValid ? '✅' : '❌'}</div>
                            <div className="pi-summary-value">{result.local.isValid ? 'صالح' : 'غير صالح'}</div>
                            <div className="pi-summary-label">حالة الرقم</div>
                        </div>
                        <div className="pi-summary-item">
                            <div className="pi-summary-icon">📡</div>
                            <div className="pi-summary-value">{result.local.carrier || '—'}</div>
                            <div className="pi-summary-label">شركة الاتصالات</div>
                        </div>
                        <div className="pi-summary-item">
                            <div className="pi-summary-icon">🔗</div>
                            <div className="pi-summary-value">{result.webPresence?.count || 0}</div>
                            <div className="pi-summary-label">ظهور في الويب</div>
                        </div>
                        <div className="pi-summary-item">
                            <div className="pi-summary-icon">🚨</div>
                            <div className="pi-summary-value">{result.spamReports?.count || 0}</div>
                            <div className="pi-summary-label">بلاغات Spam</div>
                        </div>
                    </div>

                    <div className="pi-grid-2">
                        {/* ── القسم الأيسر ── */}
                        <div>
                            {/* معلومات أساسية */}
                            <div className="pi-section">
                                <div className="pi-section-header">
                                    <div className="pi-section-icon">📋</div>
                                    <div>
                                        <h3 className="pi-section-title">المعلومات الأساسية</h3>
                                        <p className="pi-section-subtitle">Core Information</p>
                                    </div>
                                </div>
                                <div className="pi-data-grid">
                                    <div className="pi-data-item">
                                        <div className="pi-data-label">حالة الرقم</div>
                                        <div className={`pi-data-value ${result.local.isValid ? 'valid' : 'invalid'}`}>
                                            {result.local.isValid ? '✅ صالح ومُسجّل' : '❌ غير صالح'}
                                        </div>
                                    </div>
                                    <div className="pi-data-item">
                                        <div className="pi-data-label">نوع الرقم</div>
                                        <div className="pi-data-value">{result.local.typeArabic || 'غير محدد'}</div>
                                    </div>
                                    <div className="pi-data-item">
                                        <div className="pi-data-label">البلد</div>
                                        <div className="pi-data-value">
                                            {result.local.countryNameAr || result.local.country || '—'}
                                            {result.local.country && ` (${result.local.country})`}
                                        </div>
                                    </div>
                                    <div className="pi-data-item">
                                        <div className="pi-data-label">مفتاح الاتصال</div>
                                        <div className="pi-data-value mono">+{result.local.countryCallingCode || '—'}</div>
                                    </div>
                                    <div className="pi-data-item">
                                        <div className="pi-data-label">شركة الاتصالات</div>
                                        <div className="pi-data-value">{result.local.carrier || 'غير متوفر'}</div>
                                    </div>
                                    <div className="pi-data-item">
                                        <div className="pi-data-label">الرقم الوطني</div>
                                        <div className="pi-data-value mono">{result.local.nationalNumber || '—'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* صيغ الرقم */}
                            <div className="pi-section">
                                <div className="pi-section-header">
                                    <div className="pi-section-icon">🔢</div>
                                    <div>
                                        <h3 className="pi-section-title">صيغ الرقم</h3>
                                        <p className="pi-section-subtitle">Number Formats</p>
                                    </div>
                                </div>
                                <div className="pi-formats-list">
                                    {result.local.formats && Object.entries(result.local.formats).map(([key, val]) => (
                                        val && (
                                            <div className="pi-format-row" key={key}>
                                                <span className="pi-format-label">{key.toUpperCase()}</span>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <button
                                                        className="pi-format-copy"
                                                        onClick={() => copyToClipboard(val)}
                                                        title="نسخ"
                                                    >
                                                        📋
                                                    </button>
                                                    <span className="pi-format-value">{val}</span>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>

                            {/* المنطقة الجغرافية */}
                            {result.local.region && (
                                <div className="pi-section">
                                    <div className="pi-section-header">
                                        <div className="pi-section-icon">📍</div>
                                        <div>
                                            <h3 className="pi-section-title">الموقع الجغرافي</h3>
                                            <p className="pi-section-subtitle">Geographic Location</p>
                                        </div>
                                    </div>
                                    <div className="pi-data-grid">
                                        <div className="pi-data-item">
                                            <div className="pi-data-label">المنطقة</div>
                                            <div className="pi-data-value">{result.local.region.region}</div>
                                        </div>
                                        <div className="pi-data-item">
                                            <div className="pi-data-label">المنطقة الفرعية</div>
                                            <div className="pi-data-value">{result.local.region.subregion}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* NumVerify Data */}
                            {result.numverify?.available && (
                                <div className="pi-section">
                                    <div className="pi-section-header">
                                        <div className="pi-section-icon">🔎</div>
                                        <div>
                                            <h3 className="pi-section-title">بيانات NumVerify</h3>
                                            <p className="pi-section-subtitle">Extended Verification</p>
                                        </div>
                                    </div>
                                    <div className="pi-data-grid">
                                        <div className="pi-data-item">
                                            <div className="pi-data-label">الموقع</div>
                                            <div className="pi-data-value">{result.numverify.data?.location || '—'}</div>
                                        </div>
                                        <div className="pi-data-item">
                                            <div className="pi-data-label">نوع الخط</div>
                                            <div className="pi-data-value">{result.numverify.data?.lineType || '—'}</div>
                                        </div>
                                        <div className="pi-data-item">
                                            <div className="pi-data-label">شركة الاتصالات</div>
                                            <div className="pi-data-value">{result.numverify.data?.carrier || '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── القسم الأيمن ── */}
                        <div>
                            {/* تقييم المخاطر */}
                            <div className="pi-section pi-risk-card">
                                <div className="pi-section-header">
                                    <div className="pi-section-icon">🛡️</div>
                                    <div>
                                        <h3 className="pi-section-title">تقييم المخاطر</h3>
                                        <p className="pi-section-subtitle">Risk Assessment</p>
                                    </div>
                                </div>
                                <RiskMeter
                                    score={result.riskAssessment?.score || 0}
                                    level={result.riskAssessment?.level || 'منخفض'}
                                />
                                <div className="pi-risk-label">{result.riskAssessment?.level}</div>
                                {result.riskAssessment?.factors?.length > 0 && (
                                    <div className="pi-risk-factors">
                                        {result.riskAssessment.factors.map((f, i) => (
                                            <span key={i} className="pi-risk-factor">{f}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* درجات الثقة */}
                            <div className="pi-section">
                                <div className="pi-section-header">
                                    <div className="pi-section-icon">📊</div>
                                    <div>
                                        <h3 className="pi-section-title">درجات الثقة</h3>
                                        <p className="pi-section-subtitle">Confidence Scores</p>
                                    </div>
                                </div>
                                <div className="pi-confidence-list">
                                    {result.confidenceScores?.map((item, i) => (
                                        <div key={i} className="pi-confidence-item">
                                            <div className="pi-confidence-icon">{item.icon}</div>
                                            <div className="pi-confidence-info">
                                                <div className="pi-confidence-category">{item.category}</div>
                                                <div className="pi-confidence-source">{item.source}</div>
                                            </div>
                                            <div className="pi-confidence-bar-wrapper">
                                                <div className="pi-confidence-bar">
                                                    <div
                                                        className="pi-confidence-bar-fill"
                                                        style={{
                                                            width: `${item.confidence * 10}%`,
                                                            background: getConfidenceColor(item.confidence)
                                                        }}
                                                    />
                                                </div>
                                                <span
                                                    className="pi-confidence-score"
                                                    style={{ color: getConfidenceColor(item.confidence) }}
                                                >
                                                    {item.confidence}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* بلاغات Spam */}
                            {result.spamReports?.available && (
                                <div className="pi-section">
                                    <div className="pi-section-header">
                                        <div className="pi-section-icon">🚨</div>
                                        <div>
                                            <h3 className="pi-section-title">بلاغات Spam / Scam</h3>
                                            <p className="pi-section-subtitle">Spam Reports</p>
                                        </div>
                                    </div>
                                    <div className="pi-spam-header">
                                        <span className={`pi-spam-badge ${result.spamReports.riskLevel}`}>
                                            {result.spamReports.riskLevel === 'high' ? '🔴 خطر عالي' :
                                             result.spamReports.riskLevel === 'medium' ? '🟡 متوسط' :
                                             result.spamReports.riskLevel === 'low-medium' ? '🟠 منخفض-متوسط' :
                                             '🟢 منخفض'}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                            {result.spamReports.count} بلاغ
                                        </span>
                                    </div>
                                    {result.spamReports.reports?.length > 0 && (
                                        <div className="pi-web-results">
                                            {result.spamReports.reports.slice(0, 5).map((r, i) => (
                                                <div key={i} className="pi-web-item">
                                                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="pi-web-title">
                                                        {r.title}
                                                    </a>
                                                    <div className="pi-web-domain">{r.source}</div>
                                                    <div className="pi-web-snippet">{r.snippet}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* شبكة العلاقات — عرض كامل */}
                    <div className="pi-section">
                        <div className="pi-section-header">
                            <div className="pi-section-icon">🕸️</div>
                            <div>
                                <h3 className="pi-section-title">شبكة العلاقات</h3>
                                <p className="pi-section-subtitle">Relationship Network</p>
                            </div>
                        </div>
                        <NetworkGraph network={result.network} />
                    </div>

                    {/* الظهور في الويب */}
                    {result.webPresence?.available && result.webPresence.results?.length > 0 && (
                        <div className="pi-section">
                            <div className="pi-section-header">
                                <div className="pi-section-icon">🌐</div>
                                <div>
                                    <h3 className="pi-section-title">الظهور في المواقع العامة</h3>
                                    <p className="pi-section-subtitle">Web Presence ({result.webPresence.count} نتيجة)</p>
                                </div>
                            </div>
                            <div className="pi-web-results">
                                {result.webPresence.results.map((r, i) => (
                                    <div key={i} className="pi-web-item">
                                        <a href={r.link} target="_blank" rel="noopener noreferrer" className="pi-web-title">
                                            {r.title}
                                        </a>
                                        <div className="pi-web-domain">🔗 {r.domain}</div>
                                        <div className="pi-web-snippet">{r.snippet}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* الخط الزمني */}
                    {result.timeline?.length > 0 && (
                        <div className="pi-section">
                            <div className="pi-section-header">
                                <div className="pi-section-icon">📅</div>
                                <div>
                                    <h3 className="pi-section-title">الخط الزمني</h3>
                                    <p className="pi-section-subtitle">Timeline</p>
                                </div>
                            </div>
                            <div className="pi-timeline">
                                {result.timeline.map((item, i) => (
                                    <div key={i} className="pi-timeline-item">
                                        <div className={`pi-timeline-dot ${item.type === 'spam_report' ? 'spam' : ''}`} />
                                        <div className="pi-timeline-content">
                                            <div className="pi-timeline-date">
                                                {new Date(item.date).toLocaleDateString('ar-SA', {
                                                    day: 'numeric', month: 'long', year: 'numeric'
                                                })}
                                            </div>
                                            <div className="pi-timeline-title">{item.title}</div>
                                            <div className="pi-timeline-source">{item.source}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* مصادر البيانات */}
                    <div className="pi-sources">
                        {Object.entries(result.dataSources || {}).map(([key, active]) => (
                            <div key={key} className={`pi-source-badge ${active ? 'active' : 'inactive'}`}>
                                <span className={`pi-source-dot ${active ? 'active' : 'inactive'}`} />
                                {key === 'libphonenumber' ? 'تحليل محلي' :
                                 key === 'numverify' ? 'NumVerify API' :
                                 key === 'googleSearch' ? 'Google Search' :
                                 key === 'spamCheck' ? 'Spam Check' : key}
                            </div>
                        ))}
                    </div>

                    {/* زر التصدير */}
                    <div style={{ textAlign: 'center' }}>
                        <button className="pi-export-btn" onClick={exportReport}>
                            📄 تصدير التقرير
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPhoneIntel;
