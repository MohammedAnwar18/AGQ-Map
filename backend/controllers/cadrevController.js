/*
 * ───────────────────────────────────────────────────────────────────────────
 *  PalNovaa CadRev — نشر المشاريع ومشاركتها برابطٍ محميّ بكلمة مرور
 * ───────────────────────────────────────────────────────────────────────────
 *
 *  أداة CadRev أداةٌ عامّة (صفحة ثابتة) تُخزّن مشاريع المستخدم في متصفّحه.
 *  عند «نشر المشروع» تُرسَل نسخةٌ كاملةٌ منه (مبانٍ، شوارع، مواقف، كسوات،
 *  صور، بيانات الطوابق…) فتُحفَظ هنا بكلمة مرور يحدّدها صاحب المشروع، ويعود
 *  له رابطٌ قابلٌ للنسخ. من يفتح الرابط يُدخل كلمة المرور فيشاهد المشروع
 *  للقراءة فقط (معلومات المباني وبياناتها) دون أي تعديل.
 *
 *  مستقلٌّ تماماً عن باقي النظام: جدولٌ واحدٌ خاصٌّ به ولا مصادقة مستخدم.
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const newId = () => crypto.randomBytes(8).toString('hex'); // 16 hex chars، غير قابل للتخمين

// ── نشر مشروع جديد ─────────────────────────────────────────────────────────
const publish = async (req, res) => {
    try {
        let { name, password, data } = req.body || {};
        name = (name || '').toString().trim().slice(0, 120);
        if (!name) return res.status(400).json({ error: 'اسم المشروع مطلوب' });
        if (!password || password.toString().length < 3)
            return res.status(400).json({ error: 'كلمة المرور قصيرة (3 أحرف على الأقل)' });
        if (data == null) return res.status(400).json({ error: 'لا توجد بيانات للنشر' });

        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        if (dataStr.length > 45 * 1024 * 1024)
            return res.status(413).json({ error: 'المشروع كبير جداً للنشر. قلّل الصور أو احذف المجسّمات الثقيلة.' });

        const hash = await bcrypt.hash(password.toString(), 10);

        let id, ok = false;
        for (let i = 0; i < 6 && !ok; i++) {
            id = newId();
            try {
                await pool.query(
                    'INSERT INTO cadrev_projects (id, name, password_hash, data) VALUES ($1, $2, $3, $4)',
                    [id, name, hash, dataStr]
                );
                ok = true;
            } catch (e) {
                if (e.code !== '23505') throw e; // 23505 = تعارض مفتاح أساسي (نادر) → أعد التوليد
            }
        }
        if (!ok) return res.status(500).json({ error: 'تعذّر إنشاء رابط فريد، حاول ثانية' });

        res.json({ id });
    } catch (err) {
        console.error('cadrev publish error:', err.message);
        res.status(500).json({ error: 'فشل النشر على الخادم' });
    }
};

// ── بيانات تعريفية للمشروع (الاسم فقط) لصفحة الدخول ─────────────────────────
const meta = async (req, res) => {
    try {
        const { id } = req.params;
        const r = await pool.query('SELECT name FROM cadrev_projects WHERE id = $1', [id]);
        if (!r.rows.length) return res.status(404).json({ error: 'المشروع غير موجود' });
        res.json({ name: r.rows[0].name });
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
};

// ── فتح المشروع بكلمة المرور (قراءة فقط) ────────────────────────────────────
const open = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body || {};
        const r = await pool.query(
            'SELECT name, password_hash, data FROM cadrev_projects WHERE id = $1',
            [id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'المشروع غير موجود' });
        const row = r.rows[0];
        const match = await bcrypt.compare((password || '').toString(), row.password_hash);
        if (!match) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });

        pool.query('UPDATE cadrev_projects SET views = views + 1 WHERE id = $1', [id]).catch(() => {});
        res.json({ name: row.name, data: row.data });
    } catch (err) {
        console.error('cadrev open error:', err.message);
        res.status(500).json({ error: 'خطأ في فتح المشروع' });
    }
};

module.exports = { publish, meta, open };
