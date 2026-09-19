import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useWorld } from './worldStore';
import { ASSETS, ASSET_KEYS, AssetThumb } from './assets';
import { importFiles, listCustom, deleteCustom, formatSize, describeStats } from './customAssets';

/* ============================================================
   متصفّح الأصول

   القائمة مقسّمة إلى تبويبات لا مكدّسة في عمود واحد: ستّ فئات
   وخمسة عشر مجسماً في قائمة واحدة تعني تمريراً لا ينتهي، وهو ما
   يجعل آخر عنصر بعيداً دائماً. التبويب يُبقي كل فئة في شاشة واحدة.

   والاستيراد لا يصمت أبداً: كل اختيار يُنتج تقريراً بما وصل فعلاً —
   كم ملفاً، من أي أنواع، وأيّها اعتُمد مشهداً — لأن «لا يظهر شيء»
   أسوأ من أي رسالة خطأ.
   ============================================================ */

const GROUPS = [
    { key: 'mine', label: 'مجسماتي' },
    { key: 'road', label: 'شوارع' },
    { key: 'terrain', label: 'تضاريس' },
    { key: 'build', label: 'مبانٍ' },
    { key: 'nature', label: 'طبيعة' },
    { key: 'vehicle', label: 'مركبات' },
    { key: 'street', label: 'أثاث' }
];

// هل يدعم المتصفّح اختيار مجلّد كامل؟ سفاري الجوال لا يدعمه
const folderSupported = () => {
    if (typeof document === 'undefined') return false;
    return 'webkitdirectory' in document.createElement('input');
};

const extensionOf = (name) => (name.match(/\.[^.]+$/) || ['(بلا امتداد)'])[0].toLowerCase();

/** ملخّص ما وصل من مستعرض الملفات — يُعرض قبل أي حكم بالنجاح أو الفشل */
const summarize = (files) => {
    const byExt = new Map();
    for (const file of files) {
        const ext = extensionOf(file.name);
        byExt.set(ext, (byExt.get(ext) || 0) + 1);
    }

    return [...byExt.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([ext, n]) => `${n}× ${ext}`)
        .join('، ');
};

const AssetBrowser = ({ onFlash }) => {
    const placementType = useWorld(s => s.placementType);
    const setPlacement = useWorld(s => s.setPlacement);
    const customAssets = useWorld(s => s.customAssets);
    const setCustomAssets = useWorld(s => s.setCustomAssets);
    const addCustomAsset = useWorld(s => s.addCustomAsset);
    const dropCustomAsset = useWorld(s => s.dropCustomAsset);

    const fileRef = useRef(null);
    const folderRef = useRef(null);

    const [tab, setTab] = useState('mine');
    const [busy, setBusy] = useState(null);
    const [report, setReport] = useState(null);   // { kind, title, lines[] }

    const canPickFolder = useMemo(folderSupported, []);

    useEffect(() => {
        listCustom()
            .then(setCustomAssets)
            .catch(err => setReport({
                kind: 'err',
                title: 'تعذّر فتح مخزن المجسمات',
                lines: [err.message, 'التصفّح الخاص يمنع التخزين في بعض المتصفّحات.']
            }));
    }, [setCustomAssets]);

    const grouped = useMemo(() => {
        const out = {};
        ASSET_KEYS.forEach(key => { (out[ASSETS[key].group] ||= []).push(key); });
        return out;
    }, []);

    const onPick = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';

        // الصمت هنا هو ما جعل الاستيراد يبدو معطوباً: لا شيء يُختار،
        // ولا شيء يُقال، فيظنّ المستخدم أنه أضاف مجسماً بلا أثر
        if (!files.length) {
            setReport({
                kind: 'err',
                title: 'لم يصل أي ملف',
                lines: [
                    'أُلغي الاختيار، أو أن متصفّحك لم يسلّم الملفات.',
                    canPickFolder ? '' : 'متصفّحك لا يدعم اختيار مجلّد — استخدم «اختر ملفات».'
                ].filter(Boolean)
            });
            return;
        }

        const summary = summarize(files);
        setReport({
            kind: 'info',
            title: `وصل ${files.length} ملفاً`,
            lines: [summary]
        });
        setBusy('يفحص الملفات…');

        try {
            const record = await importFiles(files);

            addCustomAsset({
                key: record.key, name: record.name, entry: record.entry,
                size: record.size, addedAt: record.addedAt, stats: record.stats
            });
            setPlacement(`custom:${record.key}`);

            setReport({
                kind: 'ok',
                title: `جاهز: ${record.name}`,
                lines: [
                    describeStats(record.stats),
                    `من ${files.length} ملفاً · ${formatSize(record.size)}`,
                    record.extras ? `تجاهلتُ ${record.extras} مشهداً آخر في الاختيار` : '',
                    'انقر المشهد أو الخريطة لوضعه.'
                ].filter(Boolean)
            });
            onFlash?.(`أُضيف ${record.name}`);
        } catch (err) {
            setReport({
                kind: 'err',
                title: 'لم يُستورد',
                lines: [err.message, `ما وصل: ${summary}`]
            });
            onFlash?.('تعذّر الاستيراد — التفاصيل في اللوحة', 'err');
        } finally {
            setBusy(null);
        }
    };

    const remove = async (card) => {
        if (!window.confirm(`حذف «${card.name}» وكل نسخه في المشهد؟`)) return;
        try {
            await deleteCustom(card.key);
            dropCustomAsset(card.key);
            onFlash?.('حُذف المجسم');
        } catch (err) {
            setReport({ kind: 'err', title: 'تعذّر الحذف', lines: [err.message] });
        }
    };

    const keys = tab === 'mine' ? [] : (grouped[tab] || []);

    return (
        <>
            <nav className="we-cats">
                {GROUPS.map(g => (
                    <button
                        key={g.key}
                        className={tab === g.key ? 'is-on' : ''}
                        onClick={() => setTab(g.key)}
                    >
                        {g.label}
                        {g.key === 'mine' && customAssets.length > 0 && <i>{customAssets.length}</i>}
                    </button>
                ))}
            </nav>

            {tab === 'mine' ? (
                <>
                    <div className="we-importbtns">
                        {canPickFolder && (
                            <button className="we-btn" onClick={() => folderRef.current?.click()} disabled={Boolean(busy)}>
                                استورد مجلّداً
                            </button>
                        )}
                        <button className="we-btn" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
                            اختر ملفات
                        </button>
                    </div>

                    {busy && <p className="we-note we-working"><span className="we-spin" />{busy}</p>}

                    {report && (
                        <div className={`we-report is-${report.kind}`}>
                            <header>
                                <b>{report.title}</b>
                                <button onClick={() => setReport(null)} aria-label="إخفاء">✕</button>
                            </header>
                            {report.lines.map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    )}

                    <div className="we-grid">
                        {customAssets.map(card => {
                            const type = `custom:${card.key}`;
                            return (
                                <button
                                    key={card.key}
                                    className={`we-thumb is-custom${placementType === type ? ' is-on' : ''}`}
                                    onClick={() => setPlacement(type)}
                                    title={`${card.name} · ${formatSize(card.size)}${card.stats ? ' · ' + describeStats(card.stats) : ''}`}
                                >
                                    <AssetThumb type="custom" />
                                    <em>{card.name}</em>
                                    <i
                                        className="we-thumb-x"
                                        role="button"
                                        tabIndex={0}
                                        title="حذف"
                                        onClick={(ev) => { ev.stopPropagation(); remove(card); }}
                                        onKeyDown={(ev) => ev.key === 'Enter' && remove(card)}
                                    >✕</i>
                                </button>
                            );
                        })}
                    </div>

                    <p className="we-note">
                        <b>‎.glb‎</b> ملف واحد ويكفي. <b>‎.gltf‎</b> يحتاج ملف ‎.bin‎ وصور خاماته
                        معه في نفس الاختيار — {canPickFolder
                            ? 'ولذلك «استورد مجلّداً» هو الأضمن مع الحزم الجاهزة.'
                            : 'حدّد الملفات كلّها معاً (Ctrl أو ⌘ + A داخل مجلّد التصدير).'}
                        {' '}إن نقص ملف سنُسمّيه لك بدل أن يُوضع مجسم فارغ.
                    </p>

                    <input ref={fileRef} type="file" multiple onChange={onPick} hidden />
                    {/* بلا accept عمداً: بعض الأنظمة لا تعرف ‎.gltf‎ و‎.bin‎ فتُعطّلهما في المستعرض */}
                    <input
                        ref={folderRef} type="file" multiple onChange={onPick} hidden
                        {...{ webkitdirectory: '', directory: '' }}
                    />
                </>
            ) : (
                <div className="we-grid">
                    {keys.map(key => (
                        <button
                            key={key}
                            className={`we-thumb${placementType === key ? ' is-on' : ''}`}
                            onClick={() => setPlacement(key)}
                            title={ASSETS[key].label}
                        >
                            <AssetThumb type={key} />
                            <em>{ASSETS[key].label}</em>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

export default AssetBrowser;
