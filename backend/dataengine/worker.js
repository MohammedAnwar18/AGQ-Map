#!/usr/bin/env node
/* ============================================================================
   عامل الترحيل الدائم — يُشغَّل على Hetzner (أو جهازك) لا على Vercel.
     node backend/dataengine/worker.js
   يسحب المهامّ المنتظرة من geo_jobs واحدةً تلو الأخرى، ويكتب تقدّمه في القاعدة
   فتراه لوحة Data Hub مباشرةً. آمنٌ للإيقاف: ينهي المهمّة الجارية ثمّ يخرج.
   ============================================================================ */
require('dotenv').config();
const { ensureJobs, runNextQueued } = require('./migrate');

const IDLE_MS = parseInt(process.env.DATAENGINE_POLL_MS, 10) || 5000;
let stopping = false;
let busy = false;

async function loop() {
    await ensureJobs();
    console.log(`🚚 عامل ترحيل PalNovaa يعمل — استطلاعٌ كلّ ${IDLE_MS / 1000}s`);
    while (!stopping) {
        try {
            busy = true;
            const r = await runNextQueued();
            busy = false;
            if (r) {
                console.log(r.ok ? `✅ اكتملت مهمّة (${r.count} معلم)` : `❌ فشلت مهمّة #${r.id}: ${r.reason}`);
                continue;   // لا ننتظر: قد تكون هناك مهمّةٌ تالية
            }
        } catch (e) {
            busy = false;
            console.error('خطأٌ في العامل:', e.message);
        }
        await new Promise((s) => setTimeout(s, IDLE_MS));
    }
    console.log('👋 توقّف العامل.');
    process.exit(0);
}

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
        if (stopping) process.exit(1);
        stopping = true;
        console.log(`\n${sig}: سأتوقّف بعد ${busy ? 'انتهاء المهمّة الجارية' : 'لحظة'}…`);
    });
}

loop().catch((e) => { console.error('فشلٌ قاتل:', e); process.exit(1); });
