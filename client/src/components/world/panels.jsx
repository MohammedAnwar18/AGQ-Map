import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useWorld } from './worldStore';
import { field, measureField, TERRAIN_SPAN } from './terrain';
import { cityPlan, DISTRICTS } from './city';
import { ASSETS } from './assets';
import { forgetStyled } from './customAssets';
import MiniMap from './MiniMap';
import Browser from './AssetBrowser';
import { saveFile } from '../../utils/download';
import gameService, { gameError } from '../../services/gameApi';

/* ============================================================
   لوحات المحرّر الأربع

   كلها HTML فوق الـ Canvas لا داخله: تقرأ من مخزن zustand وتكتب
   فيه، والمشهد يلتقط التغيير من هناك. لا تمرّ خاصيّة واحدة عبر
   حدود الـ Canvas، وهو ما يُبقي الطبقتين مستقلّتين فعلاً.
   ============================================================ */

// ── لبنات صغيرة ─────────────────────────────────────────────

const Slider = ({ label, value, min, max, step = 0.01, onChange, left, right, readout }) => (
    <label className="we-slider">
        <span className="we-slider-top">
            <b>{label}</b>
            {readout && <em>{readout}</em>}
        </span>
        <input
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {(left || right) && (
            <span className="we-slider-ends"><i>{left}</i><i>{right}</i></span>
        )}
    </label>
);

const Switch = ({ label, checked, onChange }) => (
    <button
        type="button"
        className={`we-switch${checked ? ' is-on' : ''}`}
        onClick={onChange}
        role="switch"
        aria-checked={checked}
    >
        <span>{label}</span>
        <i />
    </button>
);

/**
 * قسم يُطوى.
 *
 * لوحة تحكّم العالم صارت أطول من الشاشة على الهاتف، والتمرير وحده
 * لا يكفي: الطيّ يجعل ما تبحث عنه على بُعد لمستين لا عشرين تمريرة.
 * المفتوح يبقى مفتوحاً في الجلسة، فلا تُعاد فتح ما تعمل عليه.
 */
const Section = ({ label, children, defaultOpen = false, badge }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`we-sec${open ? ' is-open' : ''}`}>
            <button className="we-sec-head" onClick={() => setOpen(v => !v)} aria-expanded={open}>
                <span>{label}</span>
                {badge && <em>{badge}</em>}
                <i aria-hidden="true">{open ? '−' : '+'}</i>
            </button>
            {open && <div className="we-sec-body">{children}</div>}
        </div>
    );
};

const PanelShell = ({ title, children, onClose, className = '' }) => (
    <section className={`we-panel ${className}`}>
        <header className="we-panel-head">
            <h3>{title}</h3>
            {onClose && <button className="we-x" onClick={onClose} aria-label="إخفاء">✕</button>}
        </header>
        <div className="we-panel-body">{children}</div>
    </section>
);

// ساعة عشرية إلى توقيت مقروء
const clock = (hour) => {
    const h = Math.floor(hour) % 24;
    const m = Math.round((hour - Math.floor(hour)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m === 60 ? 59 : m).padStart(2, '0')}`;
};

const partOfDay = (hour) => {
    if (hour < 5) return 'ليل';
    if (hour < 7.5) return 'شروق';
    if (hour < 16) return 'نهار';
    if (hour < 19) return 'غروب';
    return 'ليل';
};

// ── ١) لوحة تحكم العالم ───────────────────────

const MODES = [
    ['orbit', 'تحرير'],
    ['walk', 'مشي'],
    ['drive', 'قيادة']
];

const MODE_HINT = {
    orbit: 'دوران حول المشهد بالسحب، وتكبير بالعجلة. بدّل إلى «مشي» لتسير داخل العالم، أو إلى «قيادة» لتقود سيارة فيزيائية على التضاريس.',
    walk: 'انقر المشهد لتثبيت المؤشّر، ثم W A S D للحركة و Shift للركض و Esc للخروج. على الهاتف: العصا للمشي والسحب للنظر.',
    drive: 'W خانق · S رجوع وفرملة · A / D مقود · Shift تسارع · مسافة فرملة يد. الفيزياء تُشغّل تلقائياً مع هذا الوضع.'
};

export const WorldPanel = ({ onClose }) => {
    const env = useWorld(s => s.environment);
    const entities = useWorld(s => s.entities);
    const mode = useWorld(s => s.mode);
    const setEnv = useWorld(s => s.setEnv);
    const setMode = useWorld(s => s.setMode);
    const toggleEntity = useWorld(s => s.toggleEntity);

    return (
        <PanelShell title="لوحة تحكم العالم" onClose={onClose} className="we-world">
            <div className="we-group">
                <span className="we-group-label">وضع التجوّل</span>
                <div className="we-seg">
                    {MODES.map(([key, label]) => (
                        <button
                            key={key}
                            className={mode === key ? 'is-on' : ''}
                            onClick={() => setMode(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <p className="we-note">{MODE_HINT[mode]}</p>
            </div>

            <Slider
                label="وقت اليوم"
                readout={`${clock(env.timeOfDay)} · ${partOfDay(env.timeOfDay)}`}
                value={env.timeOfDay} min={0} max={24} step={0.1}
                onChange={(v) => setEnv('timeOfDay', v)}
                left="منتصف الليل" right="منتصف الليل"
            />

            <Slider
                label="الطقس"
                readout={env.climate < 0.33 ? 'مشمس' : env.climate < 0.7 ? 'غائم جزئياً' : 'غائم'}
                value={env.climate} min={0} max={1}
                onChange={(v) => setEnv('climate', v)}
                left="مشمس" right="غائم"
            />

            <Slider
                label="كثافة الأشجار"
                readout={`${Math.round(env.foliageDensity * 100)}%`}
                value={env.foliageDensity} min={0} max={1}
                onChange={(v) => setEnv('foliageDensity', v)}
                left="خالٍ" right="كثيف"
            />

            <Section label="نمط العرض" badge={(env.renderStyle || 'toon') === 'real' ? 'واقعي' : 'كرتوني'}>
                <div className="we-seg">
                    {[['toon', 'كرتوني'], ['real', 'واقعي']].map(([key, label]) => (
                        <button
                            key={key}
                            className={(env.renderStyle || 'toon') === key ? 'is-on' : ''}
                            onClick={() => {
                                // النسخ المُنمّطة مُخزّنة؛ نُبطلها لتُبنى بالخامات الجديدة
                                forgetStyled();
                                setEnv('renderStyle', key);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <p className="we-note">
                    الواقعي يُبقي خامات glTF كما صُدّرت — خرائط الخشونة والمعدنية
                    والانحناء — ويُضيف إضاءة بيئة تنعكس عليها، ويُطفئ الحدود المحيطة.
                    أثقل من الكرتوني، وأليق بحزمة فيها خرائط ORM.
                </p>
            </Section>

            <Section label="نمط المباني" badge={env.buildingStyle === 'urban' ? 'مدينة' : 'ضواحٍ'}>
                <div className="we-seg">
                    {[['suburban', 'ضواحٍ'], ['urban', 'مدينة']].map(([key, label]) => (
                        <button
                            key={key}
                            className={env.buildingStyle === key ? 'is-on' : ''}
                            onClick={() => setEnv('buildingStyle', key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </Section>

            <Section label="الأرض والشبكة">
                <Switch
                    label="الطريق الجاهز في المشهد"
                    checked={env.defaultRoad !== false}
                    onChange={() => setEnv('defaultRoad', env.defaultRoad === false)}
                />
                <Switch
                    label="الالتقاط إلى الشبكة"
                    checked={env.gridSnap !== false}
                    onChange={() => setEnv('gridSnap', env.gridSnap === false)}
                />
                <Slider
                    label="مقاس خليّة الشبكة"
                    readout={`${env.gridSize || 8} م`}
                    value={env.gridSize || 8} min={2} max={16} step={1}
                    onChange={(v) => setEnv('gridSize', v)}
                />
                <p className="we-note">
                    بلاطات الشوارع والتضاريس تلتقط الشبكة دائماً لتتلاصق بلا فجوات،
                    مهما كان هذا المفتاح. أطفئ «الطريق الجاهز» لترسم شبكتك من الصفر.
                </p>
            </Section>

            <Section label="التحكم بالكيانات">
                <Switch label="حركة المرور" checked={entities.traffic} onChange={() => toggleEntity('traffic')} />
                <Switch label="المشاة" checked={entities.npcs} onChange={() => toggleEntity('npcs')} />
            </Section>

            <Section label="الجودة والأداء">
                <Switch label="الحدود المحيطة" checked={env.outlines !== false} onChange={() => setEnv('outlines', env.outlines === false)} />
                <Switch label="ظلال الاحتكاك (SSAO)" checked={env.heavyShading} onChange={() => setEnv('heavyShading', !env.heavyShading)} />
                <p className="we-note">
                    SSAO يُعمّق الالتقاء بين المجسمات والأرض لكنه الأثقل هنا؛
                    أطفئه أولاً إن تعثّرت الحركة على جهاز متوسّط.
                </p>
            </Section>
        </PanelShell>
    );
};

// ── لوحة التضاريس والفيزياء ──────────────────

const TOOLS = [
    { key: null, label: 'إيقاف' },
    { key: 'raise', label: 'رفع' },
    { key: 'lower', label: 'خفض' },
    { key: 'flatten', label: 'تسوية' },
    { key: 'smooth', label: 'تنعيم' },
    { key: 'dig', label: 'حفر ماء' }
];

const TOOL_HINT = {
    raise: 'اسحب على الأرض لترفعها — طول السحبة هو مقدار الارتفاع، فابنِ التلّة على مهل.',
    lower: 'يخفض الأرض. للوصول إلى ما تحت منسوب الماء استعمل «حفر ماء» — أسرع ويفتح الماء معه.',
    flatten: 'يسحب كل ما تحت الفرشاة إلى ارتفاع نقطة البدء — لتمهيد أرض قبل رصف شارع أو بناء.',
    smooth: 'يذيب الحوافّ الحادّة ويهدّئ المنحدرات. مرّره على ما نحتّه فيبدو طبيعياً.',
    dig: 'يحفر بقوّة ويفتح الماء تلقائياً: كل ما ينزل تحت المنسوب يمتلئ وحده.'
};

/**
 * لوحة التضاريس.
 *
 * ثلاث طبقات في واحدة: تشكيل الأرض، ثم ملءها ماء، ثم إطلاق
 * الفيزياء عليها. الترتيب مقصود — وهو ترتيب العمل نفسه.
 */
export const TerrainPanel = ({ onClose, onFlash }) => {
    const terrain = useWorld(s => s.terrain);
    const cityCfg = useWorld(s => s.city);
    const brush = useWorld(s => s.brush);
    const physics = useWorld(s => s.physics);
    const mode = useWorld(s => s.mode);
    const revision = useWorld(s => s.terrainRevision);

    const setTerrain = useWorld(s => s.setTerrain);
    const setCity = useWorld(s => s.setCity);
    const rollCity = useWorld(s => s.rollCity);
    const setBrush = useWorld(s => s.setBrush);
    const setPhysics = useWorld(s => s.setPhysics);
    const setMode = useWorld(s => s.setMode);
    const generate = useWorld(s => s.generateTerrain);
    const level = useWorld(s => s.levelTerrain);

    // المدى يُقاس عند كل تغيّر لا في كل إطار
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const range = useMemo(() => measureField(), [revision]);
    const plan = useMemo(() => cityPlan(cityCfg), [cityCfg]);

    const pickTool = (key) => {
        setBrush('tool', brush.tool === key ? null : key);
        // الحفر بلا ماء حفرة جافّة لا بركة؛ نفتح الماء معه
        if (key === 'dig' && !terrain.water) setTerrain('water', true);
    };

    const fillLow = () => {
        const { min, max } = measureField();
        if (max - min < 0.4) {
            onFlash?.('الأرض مستوية — احفر أوّلاً ثم املأ', 'err');
            return;
        }
        setTerrain('waterLevel', +(min + (max - min) * 0.34).toFixed(2));
        setTerrain('water', true);
        onFlash?.('امتلأت المنخفضات');
    };

    const build = () => {
        const { min, max } = generate();
        onFlash?.(`وُلّدت التضاريس — من ${min.toFixed(1)} إلى ${max.toFixed(1)} م`);
    };

    return (
        <PanelShell title="التضاريس والفيزياء" onClose={onClose} className="we-land">
            <div className="we-group">
                <span className="we-group-label">فرشاة النحت</span>
                <div className="we-tools">
                    {TOOLS.map(t => (
                        <button
                            key={t.key || 'off'}
                            className={(brush.tool || null) === t.key ? 'is-on' : ''}
                            onClick={() => (t.key ? pickTool(t.key) : setBrush('tool', null))}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {brush.tool ? (
                    <>
                        <Slider
                            label="قطر الفرشاة"
                            readout={`${Math.round(brush.radius * 2)} م`}
                            value={brush.radius} min={3} max={48} step={1}
                            onChange={(v) => setBrush('radius', v)}
                            left="دقيق" right="واسع"
                        />
                        <Slider
                            label="قوّة الفرشاة"
                            readout={`${Math.round(brush.strength * 100)}%`}
                            value={brush.strength} min={0.05} max={1} step={0.05}
                            onChange={(v) => setBrush('strength', v)}
                            left="لطيف" right="عنيف"
                        />
                        <p className="we-note">{TOOL_HINT[brush.tool]}</p>
                    </>
                ) : (
                    <p className="we-note">
                        اختر أداة ثم اسحب على الأرض في المشهد. الحلقة تُريك مدى الفرشاة
                        قبل أن تضرب. ودوران الكاميرا يتجمّد ما دامت أداة مختارة —
                        السحب للنحت لا للدوران — ويعود بمجرّد إيقافها، والتكبير يبقى.
                    </p>
                )}
            </div>

            <div className="we-readout">
                <span>أخفض <b>{range.min.toFixed(1)}</b> م</span>
                <span>أعلى <b>{range.max.toFixed(1)}</b> م</span>
                <span>المساحة <b>{TERRAIN_SPAN}</b> م</span>
            </div>

            <Section label="التوليد الإجرائي">
                <Slider
                    label="ارتفاع التضاريس"
                    readout={`${terrain.amplitude.toFixed(1)} م`}
                    value={terrain.amplitude} min={1} max={22} step={0.5}
                    onChange={(v) => setTerrain('amplitude', v)}
                    left="سهل" right="جبلي"
                />
                <Slider
                    label="خشونة السطح"
                    readout={`${Math.round(terrain.roughness * 100)}%`}
                    value={terrain.roughness} min={0} max={1} step={0.05}
                    onChange={(v) => setTerrain('roughness', v)}
                    left="ناعم" right="مكسّر"
                />
                <Slider
                    label="اتّساع التلال"
                    readout={`${Math.round(terrain.featureScale * 100)}%`}
                    value={terrain.featureScale} min={0.15} max={1} step={0.05}
                    onChange={(v) => setTerrain('featureScale', v)}
                    left="نتوءات" right="تلال عريضة"
                />
                <Slider
                    label="البذرة"
                    readout={`#${terrain.seed % 1000}`}
                    value={terrain.seed % 1000} min={0} max={999} step={1}
                    onChange={(v) => setTerrain('seed', 20260000 + v)}
                />

                <div className="we-row2">
                    <button className="we-btn" onClick={build}>ولّد تضاريس</button>
                    <button className="we-btn" onClick={() => { level(); onFlash?.('عادت الأرض مستوية'); }}>سوِّ الأرض</button>
                </div>

                <p className="we-note">
                    ضجيج Simplex على أربع طبقات (fBm): تلال كبيرة عليها نتوءات صغيرة.
                    وممرّ الطريق الجاهز يُسطّح تلقائياً ما دام مفتوحاً، كما يُشقّ الطريق فعلاً.
                </p>
            </Section>

            <Section label="الماء" badge={terrain.water ? 'مفتوح' : null} defaultOpen={terrain.water}>
                <Switch
                    label="سطح الماء"
                    checked={terrain.water}
                    onChange={() => setTerrain('water', !terrain.water)}
                />
                <Slider
                    label="منسوب الماء"
                    readout={`${terrain.waterLevel.toFixed(2)} م`}
                    value={terrain.waterLevel} min={-16} max={12} step={0.1}
                    onChange={(v) => setTerrain('waterLevel', v)}
                    left="عميق" right="فائض"
                />
                <Slider
                    label="ارتفاع الموج"
                    readout={`${Math.round(terrain.waveHeight * 100)}%`}
                    value={terrain.waveHeight} min={0} max={1.6} step={0.05}
                    onChange={(v) => setTerrain('waveHeight', v)}
                    left="ساكن" right="هائج"
                />
                <button className="we-btn" onClick={fillLow}>املأ المنخفضات</button>
                <p className="we-note">
                    منسوب واحد للعالم كلّه كالمياه الجوفية: ما ينزل تحته يمتلئ،
                    وما يرتفع فوقه ينحسر. والموج معادلة Gerstner داخل الشيدر —
                    إزاحة رؤوس لا محاكاة سوائل، فلا تكلفة تُذكر.
                </p>
            </Section>

            <Section label="الفيزياء" badge={physics.enabled ? 'تعمل' : null} defaultOpen={physics.enabled}>
                <Switch
                    label="محرّك الفيزياء (Rapier)"
                    checked={physics.enabled}
                    onChange={() => setPhysics('enabled', !physics.enabled)}
                />

                {physics.enabled && (
                    <>
                        <button
                            className={`we-btn${mode === 'drive' ? ' we-primary' : ''}`}
                            onClick={() => setMode(mode === 'drive' ? 'orbit' : 'drive')}
                        >
                            {mode === 'drive' ? 'اخرج من القيادة' : 'قُد السيارة'}
                        </button>

                        <Slider
                            label="الجاذبية"
                            readout={`${physics.gravity.toFixed(2)} م/ث²`}
                            value={physics.gravity} min={0.5} max={25} step={0.25}
                            onChange={(v) => setPhysics('gravity', v)}
                            left="قمر" right="ثقيلة"
                        />
                        <Slider
                            label="أجسام حرّة تتدحرج"
                            readout={`${physics.debris}`}
                            value={physics.debris} min={0} max={40} step={1}
                            onChange={(v) => setPhysics('debris', v)}
                            left="بلا" right="كثير"
                        />
                        <Switch label="الطفو على الماء" checked={physics.buoyancy} onChange={() => setPhysics('buoyancy', !physics.buoyancy)} />
                        <Switch label="إظهار هياكل الاصطدام" checked={physics.debug} onChange={() => setPhysics('debug', !physics.debug)} />
                    </>
                )}

                <p className="we-note">
                    هيكل الأرض Heightfield مبنيّ من نفس حقل الارتفاعات المرئي،
                    ويُعاد بناؤه عند نهاية كل سحبة نحت. والسيارة Raycast Vehicle:
                    أربعة أشعّة تحت العجلات ونوابض تحمل الهيكل، فتميل مع ميل الأرض
                    وتنزل عجلة واحدة في الحفرة. الحزمة تُجلب عند أوّل تشغيل فقط.
                </p>
            </Section>

            <Section label="المدينة" badge={cityCfg.enabled ? `${plan?.counts.buildings || 0} مبنى` : null} defaultOpen={cityCfg.enabled}>
                <Switch
                    label="المدينة المولّدة"
                    checked={cityCfg.enabled}
                    onChange={() => setCity('enabled', !cityCfg.enabled)}
                />

                {cityCfg.enabled && plan && (
                    <>
                        <div className="we-readout">
                            <span>مبانٍ <b>{plan.counts.buildings}</b></span>
                            <span>أثاث <b>{plan.counts.props}</b></span>
                            <span>مركبات <b>{plan.counts.cars}</b></span>
                        </div>

                        <div className="we-zones">
                            {Object.entries(DISTRICTS).map(([key, d]) => {
                                const n = plan.blocks.filter(b => b.district === key).length;
                                if (!n) return null;
                                return (
                                    <span key={key}>
                                        <i style={{ background: d.tone }} />
                                        {d.short} <b>{n}</b>
                                    </span>
                                );
                            })}
                        </div>

                        <Slider
                            label="كثافة البناء"
                            readout={`${Math.round(cityCfg.density * 100)}%`}
                            value={cityCfg.density} min={0.4} max={1} step={0.05}
                            onChange={(v) => setCity('density', v)}
                            left="خفيف" right="كامل"
                        />

                        <div className="we-row2">
                            <button className="we-btn" onClick={() => {
                                rollCity();
                                onFlash?.('مدينة جديدة بنفس الشوارع');
                            }}>مدينة أخرى</button>
                            <button className="we-btn" onClick={() => {
                                setCity('seed', 20260920);
                                onFlash?.('عادت المدينة الأصلية');
                            }}>الأصلية</button>
                        </div>
                    </>
                )}

                <p className="we-note">
                    مدينة بـ {plan ? plan.span : 0} متراً على الضلع: وسط بلد بأبراج، وسوق
                    تجاري، وأحياء سكنية، وحديقة، ومنطقة صناعية — ومسجد ومدرسة
                    وعيادة معالم يُهتدى بها. ولا يُحفظ منها في ملف العالم إلا
                    بذرتها: من يفتح عالمك يرى المدينة نفسها بلا أن يُنزّل مخطّطها.
                    وما تضعه أنت يبقى فوقها مستقلاً.
                </p>
            </Section>

            <Section label="الرصف على التضاريس">
                <Switch
                    label="تسوية الأرض تحت البلاطة"
                    checked={terrain.autoFlatten}
                    onChange={() => setTerrain('autoFlatten', !terrain.autoFlatten)}
                />
                <p className="we-note">
                    بلاطة الشارع صفيحة مستوية: على منحدر تبقى حافّتها معلّقة في
                    الهواء. ومع هذا المفتاح تُسوّى الأرض تحتها وتذوب في محيطها،
                    فيُشقّ الشارع في الأرض لا يُرمى فوقها.
                </p>
            </Section>
        </PanelShell>
    );
};

// ── ٢) محرّر عقد الخريطة ────────────────────────────────────

export const NodeEditor = ({ onClose }) => (
    <PanelShell title="خريطة العالم" onClose={onClose} className="we-nodes">
        <MiniMap />
    </PanelShell>
);

// ── ٣) متصفّح الأصول ────────────────────────────────────────

export const AssetBrowser = ({ onClose, onFlash }) => (
    <PanelShell title="متصفّح الأصول" onClose={onClose} className="we-assets">
        <Browser onFlash={onFlash} />
    </PanelShell>
);

// ── محدّد العنصر المختار ────────────────────────────────────

export const Inspector = () => {
    const selectedId = useWorld(s => s.selectedId);
    const placed = useWorld(s => s.placed);
    const updateItem = useWorld(s => s.updateItem);
    const removeItem = useWorld(s => s.removeItem);
    const select = useWorld(s => s.select);

    const custom = useWorld(s => s.customAssets);

    const item = placed.find(p => p.id === selectedId);
    if (!item) return null;

    const isCustom = item.type.startsWith('custom:');
    const title = isCustom
        ? (custom.find(c => `custom:${c.key}` === item.type)?.name || 'مجسم مستورد')
        : (ASSETS[item.type]?.label || item.type);

    // ربع دورة: الطريقة الوحيدة العملية لتوجيه بلاطة شارع
    const quarter = () => {
        const next = (item.rotation + Math.PI / 2) % (Math.PI * 2);
        updateItem(item.id, { rotation: +next.toFixed(4) });
    };

    return (
        <section className="we-panel we-inspector">
            <header className="we-panel-head">
                <h3>{title}</h3>
                <button className="we-x" onClick={() => select(null)} aria-label="إلغاء التحديد">✕</button>
            </header>
            <div className="we-panel-body">
                <button className="we-btn" onClick={quarter}>أدر ربع دورة (٩٠°)</button>

                <Slider
                    label="الدوران" readout={`${Math.round((item.rotation * 180) / Math.PI)}°`}
                    value={item.rotation} min={0} max={Math.PI * 2} step={0.05}
                    onChange={(v) => updateItem(item.id, { rotation: v })}
                />
                <Slider
                    label="الحجم" readout={`${item.scale.toFixed(2)}×`}
                    value={item.scale} min={0.4} max={2.5} step={0.05}
                    onChange={(v) => updateItem(item.id, { scale: v })}
                />
                <div className="we-coords">
                    <span>س {item.x}</span>
                    <span>ص {item.z}</span>
                </div>
                <button className="we-btn we-danger" onClick={() => removeItem(item.id)}>حذف المجسم</button>
            </div>
        </section>
    );
};

// ── ٤) التسجيل ──────────────────────────────────────────────

// المتصفّحات تختلف فيما تسجّله: سفاري يكتب MP4 مباشرة، وكروم/فايرفوكس
// يكتبان WebM. نختار الأفضل المتاح ونُسمّي الزرّ بما سيهبط فعلاً،
// بدل أن نَعِد بـ MP4 ثم نُنزّل شيئاً آخر.
const MIME_CANDIDATES = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
];

const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    return MIME_CANDIDATES.find(m => {
        try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
    }) || '';
};

export const RecordBar = ({ canvasRef, onFlash, onClose }) => {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);

    const recRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const mime = useMemo(() => pickMime(), []);
    const ext = mime?.includes('mp4') ? 'mp4' : 'webm';
    const supported = mime !== null;

    // نوقف التسجيل عند إغلاق المحرّر، وإلا بقي المسجّل ممسكاً باللوحة
    useEffect(() => () => {
        clearInterval(timerRef.current);
        try { recRef.current?.state === 'recording' && recRef.current.stop(); } catch { /* أُوقف سلفاً */ }
    }, []);

    const start = () => {
        const canvas = canvasRef.current;
        if (!canvas) return onFlash?.('لوحة الرسم غير جاهزة بعد', 'err');
        if (!supported) return onFlash?.('متصفّحك لا يدعم التسجيل من الصفحة', 'err');

        try {
            const stream = canvas.captureStream(60);
            const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);

            chunksRef.current = [];
            rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };

            rec.onstop = async () => {
                clearInterval(timerRef.current);
                const blob = new Blob(chunksRef.current, { type: mime || 'video/webm' });
                chunksRef.current = [];

                if (!blob.size) return onFlash?.('لم يُسجَّل شيء', 'err');

                const name = `world_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
                await saveFile(blob, name, blob.type);
                onFlash?.(`نُزّل ${name}`);
            };

            rec.start(250);
            recRef.current = rec;
            setRecording(true);
            setSeconds(0);
            timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
        } catch (e) {
            onFlash?.(`تعذّر بدء التسجيل: ${e.message}`, 'err');
        }
    };

    const stop = () => {
        try { recRef.current?.stop(); } catch { /* لا شيء يُوقَف */ }
        setRecording(false);
        clearInterval(timerRef.current);
    };

    return (
        <PanelShell title="التسجيل" onClose={onClose} className="we-record">
            <button
                className={`we-btn we-rec${recording ? ' is-live' : ''}`}
                onClick={recording ? stop : start}
                disabled={!supported}
            >
                <i />
                {recording
                    ? `إيقاف — ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
                    : `ابدأ التسجيل (${ext.toUpperCase()})`}
            </button>

            {!supported && <p className="we-note">متصفّحك لا يوفّر MediaRecorder.</p>}
            {supported && ext === 'webm' && (
                <p className="we-note">
                    متصفّحك يسجّل WebM لا MP4 — يعمل على الحاسوب، وتحويله إلى MP4
                    يحتاج أداة خارجية مثل ffmpeg.
                </p>
            )}
        </PanelShell>
    );
};

// ── شريط حفظ العالم ─────────────────────────────────────────

export const WorldFile = ({ onFlash }) => {
    const exportWorld = useWorld(s => s.exportWorld);
    const importWorld = useWorld(s => s.importWorld);
    const resetWorld = useWorld(s => s.resetWorld);
    const clearAll = useWorld(s => s.clearAll);
    const count = useWorld(s => s.placed.length);

    const fileRef = useRef(null);
    const [publishing, setPublishing] = useState(false);

    /**
     * النشر.
     *
     * الحفظ إلى ملف يُبقي العالم عندك؛ النشر يجعله **العالم** الذي
     * يفتحه كل من يُدخل رقمك. هو الخطوة التي تُحوّل ما بنيته من
     * مسوّدة إلى مكان يزوره الناس.
     */
    const publish = async () => {
        setPublishing(true);
        try {
            const result = await gameService.saveWorld(exportWorld(), null);
            onFlash?.(`نُشر العالم — ${(result.size / 1024).toFixed(0)} ك.بايت`);
        } catch (err) {
            onFlash?.(gameError(err, 'تعذّر النشر'), 'err');
        } finally {
            setPublishing(false);
        }
    };

    const save = async () => {
        const blob = new Blob([JSON.stringify(exportWorld(), null, 2)], { type: 'application/json' });
        await saveFile(blob, 'world.json', 'application/json');
        onFlash?.(`حُفظ العالم — ${count} مجسماً`);
    };

    const load = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        try {
            importWorld(JSON.parse(await file.text()));
            onFlash?.('استُرجع العالم من الملف');
        } catch (err) {
            onFlash?.(`ملف غير صالح: ${err.message}`, 'err');
        }
    };

    return (
        <div className="we-filebar">
            <button
                className="we-btn we-publish"
                onClick={publish}
                disabled={publishing}
                title="يجعل ما بنيته هو العالم الذي يفتحه من يُدخل رقمك"
            >
                {publishing ? 'ينشر…' : '◈ انشر العالم للاعبين'}
            </button>

            <button className="we-btn" onClick={save}>حفظ world.json</button>
            <button className="we-btn" onClick={() => fileRef.current?.click()}>تحميل ملف</button>
            <button className="we-btn" onClick={() => { clearAll(); onFlash?.('أُفرغ العالم'); }}>إفراغ</button>
            <button className="we-btn" onClick={() => { resetWorld(); onFlash?.('عاد المشهد الابتدائي'); }}>استعادة</button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={load} hidden />
        </div>
    );
};
