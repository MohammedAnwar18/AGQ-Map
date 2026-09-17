import React, { useState, useEffect, useCallback, useRef } from 'react';
import { hellyService } from '../services/hellyApi';
import HellyMark from './HellyMark';
import { STANCE_TONE, STANCES } from './hellyTheme';
import { AreaStudio, ForecastPanel } from './HellySpatial';
import './HellyAgents.css';

/* ============================================================
   HellyAgents — محرّك محاكاة جماعية متعدّد الوكلاء

   نبني مجتمعاً من وكلاء مستقلّين، لكلٍّ شخصيته وموقفه، ثم نمضي بهم
   جولةً جولة: كل وكيل يسمع ما قاله الآخرون فيتكلّم وقد يتحوّل موقفه.
   يمكن حقن حدث في منتصف الطريق لرؤية أثره، ومحادثة أي وكيل، ثم
   استخراج تقرير يحلّل كيف تحرّك الرأي.

   الجولة الواحدة نداء مستقلّ والحالة في قاعدة البيانات، فالمحاكاة
   تُستأنف ولا تصطدم بمهلة الطلب.
   ============================================================ */

const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Brain: (p) => (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="7" cy="7" r="2.6" /><circle cx="17" cy="7" r="2.6" />
            <circle cx="12" cy="17" r="2.6" /><circle cx="12" cy="4.5" r="1.6" />
            <path d="M9.4 8.4 11 15M14.6 8.4 13 15M9.3 6.4h5.4" />
        </svg>
    ),
    Back: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    ),
    Play: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" {...p}>
            <polygon points="6 4 20 12 6 20" />
        </svg>
    ),
    Bolt: (p) => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    Doc: (p) => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
        </svg>
    ),
    Trash: (p) => (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    Pin: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    Gauge: (p) => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M3.5 18a9 9 0 1 1 17 0" />
            <path d="M12 18l4.6-5.4" />
            <circle cx="12" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </svg>
    )
};

// ── شريط توزيع المواقف ───────────────────────────────────────
const StanceBar = ({ distribution, total }) => (
    <div className="hla-bar">
        {STANCES.map(stance => {
            const count = distribution?.[stance] || 0;
            if (!count) return null;
            return (
                <span
                    key={stance}
                    className="hla-bar-seg"
                    style={{ width: `${(count / total) * 100}%`, background: STANCE_TONE[stance] }}
                    title={`${stance}: ${count}`}
                />
            );
        })}
    </div>
);

// ============================================================
const HellyAgents = ({ onClose }) => {
    const [view, setView] = useState('list');        // list | form | sim
    const [sims, setSims] = useState([]);
    const [sim, setSim] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);          // نصّ العملية الجارية
    const [notice, setNotice] = useState(null);
    const [chatWith, setChatWith] = useState(null);  // { agent, messages }
    const [chatDraft, setChatDraft] = useState('');
    const [injectDraft, setInjectDraft] = useState('');
    const [showReport, setShowReport] = useState(false);
    const [forecast, setForecast] = useState(null);   // لوحة الترجيح

    const [form, setForm] = useState({ topic: '', seed: '', agent_count: 12, total_rounds: 6 });
    const feedRef = useRef(null);

    const flash = (message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 3200);
    };

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const data = await hellyService.list();
            setSims(data.simulations || []);
        } catch (e) {
            flash(e?.response?.data?.error || 'تعذّر تحميل المحاكاات', 'err');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadList(); }, [loadList]);

    // ── إنشاء ──────────────────────────────────────────────────
    // مسار واحد للإطلاق: بحمولة مكانية أو بدونها
    const startSimulation = async (payload) => {
        if (!payload?.topic?.trim()) return flash('اكتب الموضوع أولاً', 'err');

        setBusy(payload.area
            ? 'يقرأ المكان ويبني سكّانه…'
            : 'يبني المجتمع ويولّد الشخصيات…');

        try {
            const created = await hellyService.create(payload);
            setSim(created);
            setView('sim');
            setShowReport(false);
            setForecast(null);
            flash(`جاهز — ${created.agents.length} وكيلاً`);
        } catch (e) {
            flash(e?.response?.data?.error || 'تعذّر إنشاء المحاكاة', 'err');
        } finally {
            setBusy(null);
        }
    };

    const create = () => startSimulation(form);

    const open = async (id) => {
        setBusy('يفتح المحاكاة…');
        try {
            setSim(await hellyService.get(id));
            setView('sim');
            setShowReport(false);
            setForecast(null);
        } catch (e) {
            flash('تعذّر فتح المحاكاة', 'err');
        } finally {
            setBusy(null);
        }
    };

    const remove = async (id, e) => {
        e?.stopPropagation();
        if (!window.confirm('حذف هذه المحاكاة وكل ما فيها؟')) return;
        try {
            await hellyService.remove(id);
            setSims(prev => prev.filter(s => s.id !== id));
            flash('حُذفت');
        } catch { flash('تعذّر الحذف', 'err'); }
    };

    // ── الجولة ─────────────────────────────────────────────────
    const step = async () => {
        setBusy(`يُجري الجولة ${sim.current_round + 1}…`);
        try {
            const next = await hellyService.step(sim.id);
            setSim(next);
            feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            flash(e?.response?.data?.error || 'تعذّرت الجولة', 'err');
        } finally {
            setBusy(null);
        }
    };

    const inject = async () => {
        const content = injectDraft.trim();
        if (!content) return;
        setBusy('يحقن الحدث…');
        try {
            setSim(await hellyService.inject(sim.id, content));
            setInjectDraft('');
            flash('حُقن الحدث — نفّذ الجولة التالية لترى أثره');
        } catch {
            flash('تعذّر الحقن', 'err');
        } finally {
            setBusy(null);
        }
    };

    const makeReport = async () => {
        setBusy('يحلّل النتائج…');
        try {
            const { report } = await hellyService.report(sim.id);
            setSim(prev => ({ ...prev, report }));
            setShowReport(true);
        } catch {
            flash('تعذّر إنشاء التقرير', 'err');
        } finally {
            setBusy(null);
        }
    };

    // ── محادثة وكيل ────────────────────────────────────────────
    const loadForecast = async () => {
        setBusy('يحسب الترجيح من حالة المحاكاة…');
        try {
            setForecast(await hellyService.forecast(sim.id));
        } catch (e) {
            flash(e?.response?.data?.error || 'تعذّر حساب الترجيح', 'err');
        } finally {
            setBusy(null);
        }
    };

    const sendChat = async () => {
        const message = chatDraft.trim();
        if (!message || busy) return;

        setChatWith(prev => ({ ...prev, messages: [...prev.messages, { from: 'me', text: message }] }));
        setChatDraft('');
        setBusy('يفكّر…');

        try {
            const { reply } = await hellyService.chat(sim.id, chatWith.agent.id, message);
            setChatWith(prev => ({ ...prev, messages: [...prev.messages, { from: 'agent', text: reply }] }));
        } catch {
            setChatWith(prev => ({ ...prev, messages: [...prev.messages, { from: 'agent', text: '(تعذّر الردّ)' }] }));
        } finally {
            setBusy(null);
        }
    };

    const shifted = sim?.agents?.filter(a => a.stance !== a.initial_stance).length || 0;
    const done = sim && sim.current_round >= sim.total_rounds;

    return (
        <div className="hla" dir="rtl">
            {/* ── الشريط العلوي ── */}
            <header className="hla-top">
                <div className="hla-brand">
                    {view !== 'list' && (
                        <button
                            className="hla-icon"
                            onClick={() => { setView('list'); setSim(null); loadList(); }}
                            aria-label="رجوع"
                        >
                            <Icon.Back />
                        </button>
                    )}
                    <HellyMark size={42} className="hla-brand-mark" />
                    <div>
                        <b>HellyAgents</b>
                        <span>محاكاة جماعية متعدّدة الوكلاء</span>
                    </div>
                </div>

                <button className="hla-icon" onClick={onClose} aria-label="إغلاق"><Icon.Close /></button>
            </header>

            {notice && <div className={`hla-flash is-${notice.kind}`}>{notice.message}</div>}
            {busy && <div className="hla-busy"><span className="hla-spin" />{busy}</div>}

            {/* ── تبويب القسمين ── */}
            {(view === 'list' || view === 'spatial') && (
                <nav className="hla-nav">
                    <button
                        className={view === 'list' ? 'is-on' : ''}
                        onClick={() => setView('list')}
                    >
                        <Icon.Brain width="17" height="17" /> المحاكاات
                    </button>
                    <button
                        className={view === 'spatial' ? 'is-on' : ''}
                        onClick={() => setView('spatial')}
                    >
                        <Icon.Pin /> الربط المكاني
                    </button>
                </nav>
            )}

            {/* ── الربط المكاني ── */}
            {view === 'spatial' && (
                <AreaStudio onLaunch={startSimulation} onFlash={flash} busy={busy} />
            )}

            {/* ── القائمة ── */}
            {view === 'list' && (
                <div className="hla-body">
                    <div className="hla-listhead">
                        <div>
                            <h2>المحاكاات</h2>
                            <p>اطرح سيناريو، ودع مجتمعاً من الوكلاء يعيشه أمامك</p>
                        </div>
                        <button className="hla-btn hla-btn-primary" onClick={() => setView('form')}>
                            + محاكاة جديدة
                        </button>
                    </div>

                    {loading ? (
                        <div className="hla-empty"><p>جاري التحميل…</p></div>
                    ) : sims.length === 0 ? (
                        <div className="hla-empty">
                            <HellyMark size={68} className="hla-empty-icon" />
                            <h3>لا محاكاات بعد</h3>
                            <p>ابدأ بسيناريو: قرار تفكّر فيه، أو خبر تريد قياس أثره.</p>
                        </div>
                    ) : (
                        <div className="hla-simlist">
                            {sims.map(s => (
                                <button className="hla-simcard" key={s.id} onClick={() => open(s.id)}>
                                    <div className="hla-simcard-head">
                                        <h3>{s.topic}</h3>
                                        <span
                                            className="hla-del"
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => remove(s.id, e)}
                                            onKeyDown={(e) => e.key === 'Enter' && remove(s.id, e)}
                                        >
                                            <Icon.Trash />
                                        </span>
                                    </div>
                                    <div className="hla-simmeta">
                                        <span>{s.agent_count} وكيلاً</span>
                                        <span>الجولة {s.current_round}/{s.total_rounds}</span>
                                        <span>{s.event_count || 0} حدث</span>
                                        {s.place_name && (
                                            <span className="hla-place"><Icon.Pin width="12" height="12" />{s.place_name}</span>
                                        )}
                                        {s.report && <em>تقرير جاهز</em>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── نموذج الإنشاء ── */}
            {view === 'form' && (
                <div className="hla-body">
                    <div className="hla-setup">
                        <div className="hla-hero">
                            <HellyMark size={72} className="hla-hero-icon" />
                            <h2>محاكاة جديدة</h2>
                            <p>سيُبنى مجتمع من وكلاء مستقلّين، لكلٍّ شخصيته وموقفه، ثم يتفاعلون جولةً بعد جولة.</p>
                        </div>

                        <div className="hla-block">
                            <label className="hla-field">
                                <span>الموضوع أو السيناريو</span>
                                <textarea
                                    value={form.topic}
                                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                                    placeholder="مثال: افتتاح سوق شعبي يغلق شارعاً رئيسياً يومي الجمعة والسبت"
                                    rows={3}
                                    autoFocus
                                />
                            </label>

                            <label className="hla-field">
                                <span>مادة خلفية <em>(اختياري — تجعل الوكلاء أدقّ)</em></span>
                                <textarea
                                    value={form.seed}
                                    onChange={(e) => setForm({ ...form, seed: e.target.value })}
                                    placeholder="معطيات، أرقام، آراء سابقة، سياق المكان…"
                                    rows={5}
                                />
                            </label>

                            <div className="hla-row">
                                <label className="hla-field">
                                    <span>عدد الوكلاء <b>{form.agent_count}</b></span>
                                    <input
                                        type="range" min="3" max="40" step="1"
                                        value={form.agent_count}
                                        onChange={(e) => setForm({ ...form, agent_count: +e.target.value })}
                                    />
                                </label>

                                <label className="hla-field">
                                    <span>عدد الجولات <b>{form.total_rounds}</b></span>
                                    <input
                                        type="range" min="1" max="40" step="1"
                                        value={form.total_rounds}
                                        onChange={(e) => setForm({ ...form, total_rounds: +e.target.value })}
                                    />
                                </label>
                            </div>

                            <p className="hla-note">
                                كل جولة تستهلك نداءات للنموذج اللغوي. ابدأ بعدد صغير لتقيس الزمن والتكلفة،
                                ثم وسّع. الجولات تُنفَّذ واحدةً واحدة ويمكنك التوقّف في أي لحظة.
                            </p>

                            <button className="hla-btn hla-btn-primary hla-wide" onClick={create} disabled={Boolean(busy)}>
                                ابدأ المحاكاة
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── المحاكاة ── */}
            {view === 'sim' && sim && (
                <div className="hla-sim">
                    {/* اللوحة الجانبية: الوكلاء */}
                    <aside className="hla-side">
                        <div className="hla-side-head">
                            <b>الوكلاء</b>
                            <span>{shifted} غيّروا موقفهم</span>
                        </div>
                        <div className="hla-agents">
                            {sim.agents.map(a => (
                                <button
                                    className="hla-agent"
                                    key={a.id}
                                    onClick={() => setChatWith({ agent: a, messages: [] })}
                                    style={{ '--tone': STANCE_TONE[a.stance] || '#94a3b8' }}
                                >
                                    <span className="hla-agent-dot" />
                                    <span className="hla-agent-text">
                                        <b>{a.name}</b>
                                        <span>{a.stance}{a.stance !== a.initial_stance ? ` ← كان ${a.initial_stance}` : ''}</span>
                                        {a.place_role && <i className="hla-agent-role">{a.place_role}</i>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </aside>

                    {/* المسرح */}
                    <section className="hla-stage">
                        <div className="hla-stage-head">
                            <h2>{sim.topic}</h2>
                            {sim.place_name && (
                                <div className="hla-place is-head"><Icon.Pin width="13" height="13" />{sim.place_name}</div>
                            )}
                            <div className="hla-progress">
                                <span>الجولة {sim.current_round} من {sim.total_rounds}</span>
                                <StanceBar distribution={sim.distribution} total={sim.agent_count || 1} />
                                <div className="hla-legend">
                                    {STANCES.map(s => (sim.distribution?.[s] ? (
                                        <span key={s}><i style={{ background: STANCE_TONE[s] }} />{s} {sim.distribution[s]}</span>
                                    ) : null))}
                                </div>
                            </div>
                        </div>

                        {/* التغذية */}
                        <div className="hla-feed" ref={feedRef}>
                            {sim.events.length === 0 ? (
                                <div className="hla-empty"><p>لم تبدأ بعد — اضغط «الجولة التالية».</p></div>
                            ) : sim.events.map(e => {
                                const agent = sim.agents.find(a => a.id === e.agent_id);
                                if (e.kind === 'injection') {
                                    return (
                                        <div className="hla-inject" key={e.id}>
                                            <Icon.Bolt /> <b>حدث مُدخَل</b>
                                            <p>{e.content}</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="hla-post" key={e.id} style={{ '--tone': STANCE_TONE[e.stance_after] || '#94a3b8' }}>
                                        <div className="hla-post-head">
                                            <b>{agent?.name || 'وكيل'}</b>
                                            <span className="hla-round">ج{e.round}</span>
                                            {e.shifted && <em className="hla-shift">غيّر موقفه → {e.stance_after}</em>}
                                        </div>
                                        <p>{e.content}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* الأدوات */}
                        <div className="hla-controls">
                            <div className="hla-inject-row">
                                <input
                                    value={injectDraft}
                                    onChange={(e) => setInjectDraft(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && inject()}
                                    placeholder="احقن حدثاً: قرار، خبر، إشاعة… ثم نفّذ الجولة التالية"
                                />
                                <button className="hla-btn" onClick={inject} disabled={Boolean(busy) || !injectDraft.trim()}>
                                    <Icon.Bolt /> حقن
                                </button>
                            </div>

                            <div className="hla-actions">
                                <button
                                    className="hla-btn hla-btn-primary"
                                    onClick={step}
                                    disabled={Boolean(busy) || done}
                                >
                                    <Icon.Play /> {done ? 'انتهت الجولات' : 'الجولة التالية'}
                                </button>
                                <button
                                    className="hla-btn hla-btn-gold"
                                    onClick={loadForecast}
                                    disabled={Boolean(busy) || !sim.current_round}
                                    title="احتمالية محسوبة من حالة المحاكاة، مع أساس كل نقطة فيها"
                                >
                                    <Icon.Gauge /> الترجيح
                                </button>
                                <button className="hla-btn" onClick={makeReport} disabled={Boolean(busy) || !sim.current_round}>
                                    <Icon.Doc /> تقرير
                                </button>
                                {sim.report && (
                                    <button className="hla-btn" onClick={() => setShowReport(true)}>عرض التقرير</button>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {/* ── محادثة وكيل ── */}
            {chatWith && (
                <div className="hla-modal-back" onClick={() => setChatWith(null)}>
                    <div className="hla-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="hla-modal-head">
                            <div>
                                <h3>{chatWith.agent.name}</h3>
                                <span>{chatWith.agent.stance}</span>
                            </div>
                            <button className="hla-icon" onClick={() => setChatWith(null)}><Icon.Close /></button>
                        </div>

                        <div className="hla-modal-body">
                            <p className="hla-persona">{chatWith.agent.persona}</p>

                            {chatWith.messages.map((m, i) => (
                                <div className={`hla-msg is-${m.from}`} key={i}>{m.text}</div>
                            ))}
                        </div>

                        <div className="hla-chatbar">
                            <input
                                value={chatDraft}
                                onChange={(e) => setChatDraft(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                placeholder="اسأله عن رأيه…"
                                autoFocus
                            />
                            <button className="hla-btn hla-btn-primary" onClick={sendChat} disabled={Boolean(busy) || !chatDraft.trim()}>
                                إرسال
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── لوحة الترجيح ── */}
            {forecast && <ForecastPanel data={forecast} onClose={() => setForecast(null)} />}

            {/* ── التقرير ── */}
            {showReport && sim?.report && (
                <div className="hla-modal-back" onClick={() => setShowReport(false)}>
                    <div className="hla-modal is-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="hla-modal-head">
                            <h3>تقرير المحاكاة</h3>
                            <button className="hla-icon" onClick={() => setShowReport(false)}><Icon.Close /></button>
                        </div>
                        <div className="hla-modal-body">
                            <pre className="hla-report">{sim.report}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HellyAgents;
