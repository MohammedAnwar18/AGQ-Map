import React, { useState, useEffect, useRef } from 'react';

import { useWorld } from './worldStore';
import { useGame, APPEARANCE_PALETTE, PART_LABELS, spacedCode, fullAppearance } from './gameStore';
import { gameError } from '../../services/gameApi';

/* ============================================================
   واجهة اللاعب

   شريط واحد في الأعلى: من أنت، وأين أنت، ومن معك. ومنه تُفتح
   بطاقتك — اسمك في اللعبة وشكلك ورقمك — وفيها الخانة التي تنقلك
   إلى عالم غيرك برقمه.

   والرقم هو مربط الفرس: ستّة أرقام تُقال بالصوت وتُكتب من الذاكرة.
   لهذا هو رقم لا رابط: الرابط يُنسخ ويُلصق، والرقم يُعطى.
   ============================================================ */

// ── شريط الحالة ─────────────────────────────────────────────

const Avatar2D = ({ look, size = 34 }) => {
    const a = fullAppearance(look);
    return (
        <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <circle cx="16" cy="16" r="16" fill={a.shirt} opacity="0.22" />
            <path d="M16 18c5 0 8 3 8 7v7H8v-7c0-4 3-7 8-7z" fill={a.shirt} />
            <circle cx="16" cy="12" r="6" fill={a.skin} />
            <path d="M10 11c0-4 3-6 6-6s6 2 6 6c-2-2-4-2.6-6-2.6S12 9 10 11z" fill={a.hair} />
        </svg>
    );
};

// ── بطاقة اللاعب ────────────────────────────────────────────

const ProfileSheet = ({ service, onFlash, onTravel }) => {
    const player = useGame(s => s.player);
    const visiting = useGame(s => s.visiting);
    const setPlayer = useGame(s => s.setPlayer);
    const isAdmin = useGame(s => s.isAdmin);
    const openSheet = useGame(s => s.openSheet);

    const [name, setName] = useState(player?.name || '');
    const [look, setLook] = useState(() => fullAppearance(player?.appearance));
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // ── السفر ──
    const [code, setCode] = useState('');
    const [peek, setPeek] = useState(null);     // { name, world } — من تزور
    const [travelState, setTravelState] = useState(null);
    const peekTimer = useRef(0);

    const dirty = name !== player?.name
        || JSON.stringify(look) !== JSON.stringify(fullAppearance(player?.appearance));

    // نستطلع الرقم أثناء الكتابة: تعرف إلى أين أنت ذاهب قبل أن تذهب
    useEffect(() => {
        clearTimeout(peekTimer.current);
        setPeek(null);

        const clean = code.replace(/\D/g, '');
        if (clean.length !== 6) return undefined;

        peekTimer.current = setTimeout(async () => {
            try {
                setPeek(await service.lookup(clean));
            } catch (err) {
                setPeek({ error: gameError(err, 'لا لاعب بهذا الرقم') });
            }
        }, 320);

        return () => clearTimeout(peekTimer.current);
    }, [code, service]);

    const save = async () => {
        if (!name.trim() || name.trim().length < 2) return onFlash('الاسم قصير جداً', 'err');

        setSaving(true);
        try {
            const data = await service.updateMe(name.trim(), look);
            setPlayer(data.player, isAdmin);
            onFlash('حُفظت البطاقة');
        } catch (err) {
            onFlash(gameError(err, 'تعذّر الحفظ'), 'err');
        } finally {
            setSaving(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(player.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            onFlash('انسخ الرقم يدوياً: ' + player.code, 'err');
        }
    };

    const travel = async (to) => {
        setTravelState('going');
        try {
            await onTravel(to);
            openSheet(null);
        } catch (err) {
            setTravelState(null);
            onFlash(gameError(err, 'تعذّر الدخول'), 'err');
        }
    };

    if (!player) return null;

    return (
        <div className="gw-sheet" role="dialog" aria-label="بطاقة اللاعب">
            <header>
                <b>بطاقتي في اللعبة</b>
                <button onClick={() => openSheet(null)} aria-label="إغلاق">✕</button>
            </header>

            <div className="gw-sheet-body">
                {/* ── الرقم التعريفي ── */}
                <section className="gw-code">
                    <span>رقمك التعريفي</span>
                    <b>{spacedCode(player.code)}</b>
                    <button className="gw-btn" onClick={copy}>
                        {copied ? '✓ نُسخ' : 'انسخ'}
                    </button>
                    <p>
                        أعطِه لمن تريد أن يزور عالمك. من يُدخله عنده يدخل عليك،
                        ويمشي فيه ويراك وتراه.
                    </p>
                </section>

                {/* ── السفر ── */}
                <section className="gw-travel">
                    <label htmlFor="gw-visit">ادخل عالم لاعب آخر</label>
                    <div className="gw-travel-row">
                        <input
                            id="gw-visit"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            inputMode="numeric"
                            placeholder="رقم من ستّ خانات"
                            autoComplete="off"
                        />
                        <button
                            className="gw-btn gw-go"
                            disabled={code.length !== 6 || travelState === 'going' || peek?.error}
                            onClick={() => travel(code)}
                        >
                            {travelState === 'going' ? '…' : 'ادخل'}
                        </button>
                    </div>

                    {peek && !peek.error && (
                        <p className="gw-peek">
                            <Avatar2D look={peek.appearance} size={22} />
                            عالم <b>{peek.name}</b>
                            {peek.world?.saved ? ' · مبنيّ ومحفوظ' : ' · بالمشهد الافتراضي'}
                        </p>
                    )}
                    {peek?.error && <p className="gw-peek is-err">{peek.error}</p>}

                    {visiting && !visiting.mine && (
                        <button className="gw-btn gw-back" onClick={() => travel(null)}>
                            ← عُد إلى عالمي
                        </button>
                    )}
                </section>

                {/* ── الاسم والشكل ── */}
                <section className="gw-look">
                    <label htmlFor="gw-name">اسمك في اللعبة</label>
                    <input
                        id="gw-name"
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 32))}
                        maxLength={32}
                        autoComplete="off"
                    />

                    <div className="gw-preview">
                        <Avatar2D look={look} size={72} />
                        <span>هكذا يراك الآخرون</span>
                    </div>

                    {Object.entries(APPEARANCE_PALETTE).map(([part, options]) => (
                        <div className="gw-swatches" key={part}>
                            <span>{PART_LABELS[part]}</span>
                            <div>
                                {options.map(color => (
                                    <button
                                        key={color}
                                        className={look[part] === color ? 'is-on' : ''}
                                        style={{ background: color }}
                                        onClick={() => setLook(v => ({ ...v, [part]: color }))}
                                        aria-label={`${PART_LABELS[part]} ${color}`}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    <button
                        className={`gw-switch${look.bag ? ' is-on' : ''}`}
                        onClick={() => setLook(v => ({ ...v, bag: !v.bag }))}
                    >
                        <span>حقيبة ظهر</span><i />
                    </button>

                    <button className="gw-btn gw-save" onClick={save} disabled={!dirty || saving}>
                        {saving ? 'يحفظ…' : dirty ? 'احفظ البطاقة' : 'محفوظة'}
                    </button>
                </section>
            </div>
        </div>
    );
};

// ── الشريط والتلميحات ───────────────────────────────────────

const GameHud = ({ fps, driving, prompt, onInteract, onClose, onFlash, service, notice }) => {
    const player = useGame(s => s.player);
    const visiting = useGame(s => s.visiting);
    const district = useGame(s => s.district);
    const nearby = useGame(s => s.nearby);
    const online = useGame(s => s.online);
    const sheet = useGame(s => s.sheet);
    const openSheet = useGame(s => s.openSheet);
    const setVisiting = useGame(s => s.setVisiting);

    /**
     * الانتقال إلى عالم برقم صاحبه.
     *
     * العالم غير المحفوظ ليس خطأً: صاحبه لم يبنِ شيئاً بعد، فيُفتح
     * على المشهد الافتراضي — نفس المدينة. وهكذا يصلح كل رقم للزيارة
     * منذ أوّل يوم بلا أن يضطرّ أحد إلى «إنشاء عالم» قبلها.
     */
    const travel = async (code) => {
        const data = await service.openWorld(code || player.code);
        const world = useWorld.getState();

        if (data.world) world.importWorld(data.world);
        else world.resetWorld();

        setVisiting({ code: data.code, owner: data.owner, mine: data.mine });
        onFlash(data.mine ? 'عُدت إلى عالمك' : `أهلاً بك في عالم ${data.owner}`);
    };

    return (
        <>
            {/* ── الشريط العلوي ── */}
            <header className="gw-top">
                <button className="gw-card" onClick={() => openSheet(sheet ? null : 'profile')}>
                    <Avatar2D look={player?.appearance} />
                    <span>
                        <b>{player?.name || '…'}</b>
                        <i>#{spacedCode(player?.code)}</i>
                    </span>
                </button>

                {district && (
                    <div className="gw-place" style={{ '--tone': district.tone }}>
                        <i />
                        <span>{district.name}</span>
                    </div>
                )}

                <div className="gw-right">
                    {visiting && !visiting.mine && (
                        <span className="gw-guest">ضيف عند {visiting.owner}</span>
                    )}

                    <span className={`gw-people${nearby ? ' is-live' : ''}`} title="من معك الآن">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                            <path d="M16 6.2a3 3 0 0 1 0 5.6M18 20c0-2.6-1-4.6-2.6-5.7" />
                        </svg>
                        {nearby}
                    </span>

                    {!online && <span className="gw-offline">لا اتّصال</span>}
                    {fps !== null && <span className={`gw-fps${fps < 28 ? ' is-low' : ''}`}>{fps}</span>}

                    <button className="gw-x" onClick={onClose} aria-label="خروج">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* ── تلميح التفاعل: هو نصف اللعبة ── */}
            {(prompt || driving) && (
                <button className="gw-prompt" onClick={onInteract}>
                    <kbd>E</kbd>
                    {driving ? 'انزل من السيارة' : `${prompt.label} · ${CAR_LABELS[prompt.car.type] || 'مركبة'}`}
                </button>
            )}

            {notice && <div className={`gw-flash is-${notice.kind}`}>{notice.message}</div>}

            {sheet === 'profile' && (
                <ProfileSheet service={service} onFlash={onFlash} onTravel={travel} />
            )}
        </>
    );
};

const CAR_LABELS = {
    car: 'سيارة', van: 'شاحنة صغيرة', pickup: 'بيك أب', taxi: 'تاكسي', bus: 'باص'
};

export default GameHud;
