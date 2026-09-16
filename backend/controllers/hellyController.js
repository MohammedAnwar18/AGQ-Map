const pool = require('../config/database');
const { complete, completeJson } = require('../utils/llm');

/**
 * HellyAgents — محرّك محاكاة جماعية متعدّد الوكلاء.
 *
 * الآليّة: نولّد مجتمعاً من وكلاء مستقلّين، لكلٍّ شخصيته وموقفه المبدئي،
 * ثم نمضي بهم جولةً جولة. في كل جولة يرى الوكيل ما قاله الآخرون وذاكرته
 * الخاصّة، فيتصرّف وقد يتحوّل موقفه. النتيجة: كيف يتطوّر رأي جماعة
 * إزاء موضوع ما عبر الزمن، وما أثر تدخّل تُدخله في منتصف الطريق.
 *
 * ملاحظة معماريّة: الجولة الواحدة طلبٌ مستقلّ والحالة كلّها في قاعدة
 * البيانات، لأن دوال الاستضافة قصيرة العمر ولا تحتمل محاكاة طويلة
 * داخل طلب واحد. العميل يقود الحلقة ويستأنف من حيث توقّف.
 */

const MAX_AGENTS = 40;
const MAX_ROUNDS = 40;

// كم وكيلاً نُحرّك في الجولة الواحدة — يوازن بين العمق ومهلة الطلب
const AGENTS_PER_ROUND = 12;

const STANCES = ['مؤيّد بشدّة', 'مؤيّد', 'محايد', 'معارض', 'معارض بشدّة'];

const isAdmin = (req) => req.user?.role === 'admin';

const requireAdmin = (req, res) => {
    if (isAdmin(req)) return true;
    res.status(403).json({ error: 'هذه الميزة للأدمن العام فقط' });
    return false;
};

const ownerId = (req) => req.user?.userId || req.user?.id || null;

// ── توليد المجتمع ────────────────────────────────────────────
const buildAgents = async ({ topic, seed, count }) => {
    const prompt = `أنشئ ${count} شخصيات مختلفة تمثّل مجتمعاً واقعياً يتفاعل مع الموضوع التالي.

الموضوع: ${topic}
${seed ? `\nمادة خلفية:\n${seed}\n` : ''}
اجعل الشخصيات متنوّعة فعلاً: أعمار ومهن وخلفيات ومواقف مختلفة، ومنهم المؤيّد والمعارض والمتردّد.

أعد مصفوفة JSON، كل عنصر:
{
  "name": "اسم عربي واقعي",
  "persona": "سطر أو سطران: العمر والمهنة والطباع وما يهمّه",
  "stance": "واحدة من: ${STANCES.join(' | ')}",
  "influence": عدد من 1 إلى 10 يمثّل مدى تأثيره في محيطه
}`;

    const raw = await completeJson(prompt, {
        system: 'أنت مصمّم محاكاة اجتماعية. تنتج شخصيات متنوّعة وواقعية بالعربية.',
        temperature: 1
    });

    const list = Array.isArray(raw) ? raw : (raw.agents || raw.personas || []);

    return list
        .map((item) => ({
            name: String(item?.name || '').trim().slice(0, 120),
            persona: String(item?.persona || '').trim().slice(0, 600),
            stance: STANCES.includes(item?.stance) ? item.stance : 'محايد',
            influence: Math.min(10, Math.max(1, parseInt(item?.influence, 10) || 5))
        }))
        .filter(a => a.name && a.persona)
        .slice(0, count);
};

// ── إنشاء محاكاة ─────────────────────────────────────────────
const createSimulation = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const topic = String(req.body.topic || '').trim().slice(0, 500);
        if (!topic) return res.status(400).json({ error: 'الموضوع مطلوب' });

        const seed = String(req.body.seed || '').trim().slice(0, 8000) || null;
        const agentCount = Math.min(MAX_AGENTS, Math.max(3, parseInt(req.body.agent_count, 10) || 12));
        const totalRounds = Math.min(MAX_ROUNDS, Math.max(1, parseInt(req.body.total_rounds, 10) || 6));

        const agents = await buildAgents({ topic, seed, count: agentCount });
        if (!agents.length) return res.status(502).json({ error: 'تعذّر توليد الوكلاء، حاول مجدداً' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const sim = await client.query(`
                INSERT INTO helly_simulations (topic, seed, agent_count, total_rounds, created_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [topic, seed, agents.length, totalRounds, ownerId(req)]);

            const simId = sim.rows[0].id;

            for (const agent of agents) {
                await client.query(`
                    INSERT INTO helly_agents (simulation_id, name, persona, stance, initial_stance, influence)
                    VALUES ($1, $2, $3, $4, $4, $5)
                `, [simId, agent.name, agent.persona, agent.stance, agent.influence]);
            }

            await client.query('COMMIT');
            res.json(await loadState(simId));
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Create simulation error:', e);
        res.status(500).json({ error: e.message || 'تعذّر إنشاء المحاكاة' });
    }
};

// ── قراءة الحالة ─────────────────────────────────────────────
const loadState = async (simId) => {
    const [sim, agents, events] = await Promise.all([
        pool.query('SELECT * FROM helly_simulations WHERE id = $1', [simId]),
        pool.query('SELECT * FROM helly_agents WHERE simulation_id = $1 ORDER BY id', [simId]),
        pool.query(
            'SELECT * FROM helly_events WHERE simulation_id = $1 ORDER BY round DESC, id DESC LIMIT 400',
            [simId]
        )
    ]);

    if (!sim.rows.length) return null;

    // توزيع المواقف الحالي — هو المخرَج الذي يهمّ المستخدم
    const distribution = {};
    STANCES.forEach(s => { distribution[s] = 0; });
    agents.rows.forEach(a => { distribution[a.stance] = (distribution[a.stance] || 0) + 1; });

    return {
        ...sim.rows[0],
        agents: agents.rows,
        events: events.rows,
        distribution
    };
};

const getSimulation = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const state = await loadState(req.params.id);
        if (!state) return res.status(404).json({ error: 'المحاكاة غير موجودة' });

        res.json(state);
    } catch (e) {
        console.error('Get simulation error:', e);
        res.status(500).json({ error: 'تعذّر قراءة المحاكاة' });
    }
};

const listSimulations = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const result = await pool.query(`
            SELECT s.*,
                   (SELECT COUNT(*)::int FROM helly_events e WHERE e.simulation_id = s.id) AS event_count
            FROM helly_simulations s
            ORDER BY s.created_at DESC
            LIMIT 100
        `);
        res.json({ simulations: result.rows });
    } catch (e) {
        console.error('List simulations error:', e);
        res.status(500).json({ error: 'تعذّر تحميل المحاكاات' });
    }
};

// ── جولة واحدة ───────────────────────────────────────────────
const stepSimulation = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const simId = req.params.id;
        const simRes = await pool.query('SELECT * FROM helly_simulations WHERE id = $1', [simId]);
        if (!simRes.rows.length) return res.status(404).json({ error: 'المحاكاة غير موجودة' });

        const sim = simRes.rows[0];
        if (sim.current_round >= sim.total_rounds) {
            return res.status(400).json({ error: 'انتهت جولات هذه المحاكاة' });
        }

        const round = sim.current_round + 1;

        // ما جرى في الجولة السابقة — هو ما "يسمعه" الوكلاء الآن
        const recent = await pool.query(`
            SELECT a.name, e.content, e.kind
            FROM helly_events e
            LEFT JOIN helly_agents a ON a.id = e.agent_id
            WHERE e.simulation_id = $1 AND e.round >= $2
            ORDER BY e.id DESC
            LIMIT 25
        `, [simId, Math.max(0, round - 2)]);

        const chatter = recent.rows.length
            ? recent.rows.reverse()
                .map(r => (r.kind === 'injection' ? `⚡ حدث: ${r.content}` : `${r.name}: ${r.content}`))
                .join('\n')
            : '(لم يتحدّث أحد بعد — هذه أول جولة)';

        // نختار الوكلاء الأكثر تأثيراً أولاً، بالتناوب عبر الجولات
        const agentsRes = await pool.query(`
            SELECT * FROM helly_agents
            WHERE simulation_id = $1
            ORDER BY ((influence * 3 + (id + $2) % 7)) DESC
            LIMIT $3
        `, [simId, round, AGENTS_PER_ROUND]);

        const roster = agentsRes.rows
            .map(a => `#${a.id} ${a.name} — ${a.persona} (موقفه الآن: ${a.stance})`)
            .join('\n');

        const prompt = `محاكاة رأي جماعي حول: ${sim.topic}

الوكلاء المتحرّكون هذه الجولة:
${roster}

ما دار في الجولة السابقة:
${chatter}

لكل وكيل أعلاه: اكتب ما سيقوله الآن (جملة إلى ثلاث، بصوته هو وبالعربية)،
وحدّد موقفه بعد سماعه ما قيل — يجوز أن يتغيّر أو يثبت، وكن واقعياً:
الناس لا تغيّر مواقفها بسهولة، والأكثر تأثّراً هم المتردّدون.

أعد مصفوفة JSON:
[{ "id": معرّف الوكيل, "says": "ما يقوله", "stance": "${STANCES.join(' | ')}", "changed_because": "سبب مختصر إن تغيّر موقفه وإلا اتركه فارغاً" }]`;

        const raw = await completeJson(prompt, {
            system: 'أنت محرّك محاكاة اجتماعية. تنطق كل شخصية بصوتها، وتُبقي التحوّلات واقعية ومتدرّجة.',
            temperature: 0.95,
            maxTokens: 2600
        });

        const moves = Array.isArray(raw) ? raw : (raw.agents || raw.moves || []);
        const known = new Map(agentsRes.rows.map(a => [String(a.id), a]));

        const client = await pool.connect();
        let applied = 0;

        try {
            await client.query('BEGIN');

            for (const move of moves) {
                const agent = known.get(String(move?.id));
                const says = String(move?.says || '').trim().slice(0, 900);
                if (!agent || !says) continue;

                const stance = STANCES.includes(move?.stance) ? move.stance : agent.stance;
                const shifted = stance !== agent.stance;

                await client.query(`
                    INSERT INTO helly_events (simulation_id, agent_id, round, kind, content, stance_after, shifted)
                    VALUES ($1, $2, $3, 'post', $4, $5, $6)
                `, [simId, agent.id, round, says, stance, shifted]);

                await client.query(`
                    UPDATE helly_agents
                    SET stance = $1,
                        last_said = $2,
                        shifts = shifts + $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                `, [stance, says, shifted ? 1 : 0, agent.id]);

                applied++;
            }

            await client.query(
                'UPDATE helly_simulations SET current_round = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [round, simId]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        if (!applied) return res.status(502).json({ error: 'لم يُنتج النموذج تحرّكات صالحة، أعد المحاولة' });

        res.json(await loadState(simId));
    } catch (e) {
        console.error('Step simulation error:', e);
        res.status(500).json({ error: e.message || 'تعذّر تنفيذ الجولة' });
    }
};

// ── حقن حدث في منتصف المحاكاة ────────────────────────────────
const injectEvent = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const simId = req.params.id;
        const content = String(req.body.content || '').trim().slice(0, 1000);
        if (!content) return res.status(400).json({ error: 'نصّ الحدث مطلوب' });

        const sim = await pool.query('SELECT current_round FROM helly_simulations WHERE id = $1', [simId]);
        if (!sim.rows.length) return res.status(404).json({ error: 'المحاكاة غير موجودة' });

        await pool.query(`
            INSERT INTO helly_events (simulation_id, agent_id, round, kind, content)
            VALUES ($1, NULL, $2, 'injection', $3)
        `, [simId, sim.rows[0].current_round, content]);

        res.json(await loadState(simId));
    } catch (e) {
        console.error('Inject event error:', e);
        res.status(500).json({ error: 'تعذّر حقن الحدث' });
    }
};

// ── محادثة وكيل بعينه ────────────────────────────────────────
const chatWithAgent = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const message = String(req.body.message || '').trim().slice(0, 1000);
        if (!message) return res.status(400).json({ error: 'الرسالة مطلوبة' });

        const agentRes = await pool.query(`
            SELECT a.*, s.topic
            FROM helly_agents a
            JOIN helly_simulations s ON s.id = a.simulation_id
            WHERE a.id = $1 AND a.simulation_id = $2
        `, [req.params.agentId, req.params.id]);

        if (!agentRes.rows.length) return res.status(404).json({ error: 'الوكيل غير موجود' });
        const agent = agentRes.rows[0];

        // ذاكرته: آخر ما قاله في المحاكاة
        const history = await pool.query(
            'SELECT content FROM helly_events WHERE agent_id = $1 ORDER BY id DESC LIMIT 6',
            [agent.id]
        );

        const reply = await complete(
            `أنت ${agent.name}.
شخصيّتك: ${agent.persona}
موقفك من «${agent.topic}»: ${agent.stance}
${history.rows.length ? `\nمما قلته سابقاً:\n${history.rows.reverse().map(h => `- ${h.content}`).join('\n')}` : ''}

سألك أحدهم: «${message}»

أجب بصوتك أنت، بالعربية، في حدود ثلاث جمل. لا تذكر أنك نموذج أو محاكاة.`,
            { temperature: 0.9, maxTokens: 400 }
        );

        res.json({ agent: agent.name, reply: String(reply || '').trim() });
    } catch (e) {
        console.error('Agent chat error:', e);
        res.status(500).json({ error: 'تعذّر الحصول على ردّ' });
    }
};

// ── تقرير ────────────────────────────────────────────────────
const buildReport = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const simId = req.params.id;
        const state = await loadState(simId);
        if (!state) return res.status(404).json({ error: 'المحاكاة غير موجودة' });

        const shifted = state.agents.filter(a => a.stance !== a.initial_stance);
        const timeline = state.events
            .slice(0, 60)
            .reverse()
            .map(e => `[ج${e.round}] ${e.kind === 'injection' ? '⚡ حدث' : ''} ${e.content}`)
            .join('\n');

        const report = await complete(
            `حلّل نتيجة محاكاة رأي جماعي.

الموضوع: ${state.topic}
عدد الوكلاء: ${state.agent_count} — الجولات المنفَّذة: ${state.current_round}

التوزيع الابتدائي مقابل النهائي:
${STANCES.map(s => {
    const before = state.agents.filter(a => a.initial_stance === s).length;
    const after = state.distribution[s] || 0;
    return `${s}: ${before} ← ${after}`;
}).join('\n')}

عدد من غيّروا موقفهم: ${shifted.length}

مقتطفات مما دار:
${timeline}

اكتب تقريراً عربياً واضحاً بهذه العناوين:
## الخلاصة
## كيف تحرّك الرأي
## الحجج الأكثر تأثيراً
## المخاطر ونقاط الانقلاب
## توصيات عملية

كن محدّداً واستشهد بما قيل فعلاً. لا تخترع أرقاماً.`,
            { temperature: 0.7, maxTokens: 2200 }
        );

        await pool.query(
            'UPDATE helly_simulations SET report = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [report, simId]
        );

        res.json({ report });
    } catch (e) {
        console.error('Report error:', e);
        res.status(500).json({ error: 'تعذّر إنشاء التقرير' });
    }
};

const deleteSimulation = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const result = await pool.query('DELETE FROM helly_simulations WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'المحاكاة غير موجودة' });

        res.json({ message: 'Simulation deleted' });
    } catch (e) {
        console.error('Delete simulation error:', e);
        res.status(500).json({ error: 'تعذّر الحذف' });
    }
};

module.exports = {
    createSimulation,
    listSimulations,
    getSimulation,
    stepSimulation,
    injectEvent,
    chatWithAgent,
    buildReport,
    deleteSimulation,
    STANCES
};
