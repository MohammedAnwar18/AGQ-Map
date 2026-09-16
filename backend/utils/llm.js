const { CohereClient } = require('cohere-ai');

/**
 * طبقة موحّدة للنموذج اللغوي.
 *
 * تفضّل أي مزوّد متوافق مع OpenAI إن ضُبطت متغيّراته (أدقّ في إخراج JSON)،
 * وإلا تعود إلى Cohere الموجود أصلاً في المشروع. هكذا يعمل المحرّك اليوم
 * بما لدينا، ويصير أقوى بمجرّد إضافة مفتاح في البيئة بلا تغيير شيفرة.
 */

const OPENAI_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_BASE = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const OPENAI_MODEL = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';

const COHERE_KEY = process.env.COHERE_API_KEY || 'GOuJk1N4r63rU4GLDwJkHQ3QLIQvr1TBz5YdNBv8';

let cohereClient = null;
const cohere = () => {
    if (!cohereClient) cohereClient = new CohereClient({ token: COHERE_KEY });
    return cohereClient;
};

const provider = () => (OPENAI_KEY ? 'openai' : 'cohere');

/**
 * ينتزع أول كائن أو مصفوفة JSON من نصّ النموذج.
 * النماذج كثيراً ما تغلّف الإجابة بشرح أو بأسوار ```json.
 */
const extractJson = (text) => {
    if (!text) return null;

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fenced ? fenced[1] : text).trim();

    try {
        return JSON.parse(body);
    } catch { /* نحاول القصّ */ }

    const start = body.search(/[[{]/);
    if (start === -1) return null;

    const opener = body[start];
    const closer = opener === '[' ? ']' : '}';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < body.length; i++) {
        const ch = body[i];

        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (ch === opener) depth++;
        else if (ch === closer) {
            depth--;
            if (depth === 0) {
                try { return JSON.parse(body.slice(start, i + 1)); } catch { return null; }
            }
        }
    }
    return null;
};

/** نداء نصّي عام */
const complete = async (prompt, { system, temperature = 0.8, maxTokens = 1200 } = {}) => {
    if (provider() === 'openai') {
        const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature,
                max_tokens: maxTokens,
                messages: [
                    ...(system ? [{ role: 'system', content: system }] : []),
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`LLM ${response.status}: ${detail.slice(0, 300)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    const result = await cohere().chat({
        message: prompt,
        preamble: system,
        temperature,
        maxTokens
    });
    return result.text || '';
};

/**
 * نداء يُلزم النموذج بإرجاع JSON، ويعيد المحاولة مرّة بتعليمات أشدّ.
 * المحرّك يعتمد على بنية ثابتة، فالفشل الصامت هنا يفسد المحاكاة كلّها.
 */
const completeJson = async (prompt, { system, temperature = 0.8, maxTokens = 1800 } = {}) => {
    const strict = `${system || ''}\n\nأجب بـ JSON صالح فقط، بلا أي نصّ قبله أو بعده، وبلا أسوار شيفرة.`;

    let raw = await complete(prompt, { system: strict, temperature, maxTokens });
    let parsed = extractJson(raw);
    if (parsed) return parsed;

    // محاولة ثانية أبرد وأصرم
    raw = await complete(
        `${prompt}\n\nتذكير: أعد JSON صالحاً فقط ولا شيء غيره.`,
        { system: strict, temperature: 0.2, maxTokens }
    );
    parsed = extractJson(raw);
    if (parsed) return parsed;

    throw new Error('تعذّر الحصول على JSON صالح من النموذج');
};

module.exports = { complete, completeJson, extractJson, provider };
