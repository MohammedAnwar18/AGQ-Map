const { CohereClient } = require('cohere-ai');

const cohere = new CohereClient({
    token: 'GOuJk1N4r63rU4GLDwJkHQ3QLIQvr1TBz5YdNBv8', // Using the key provided by user
});

const pool = require('../config/database');

exports.processQuery = async (req, res) => {
    const { query, userLocation, userInfo } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        // 1. Fetch Shops & Facilities Context directly from DB
        const shopsRes = await pool.query('SELECT id, name, bio, category, latitude, longitude FROM shops WHERE is_hidden = FALSE');
        let facilitiesRows = [];
        try {
            const facRes = await pool.query('SELECT id, name, category, latitude, longitude FROM university_facilities WHERE is_hidden = FALSE');
            facilitiesRows = facRes.rows;
        } catch (fErr) {}

        const allPlaces = [
            ...shopsRes.rows.map(s => `- SHOP: "${s.name}" | CATEGORY: "${s.category || 'General'}" | DESC: "${s.bio || 'None'}" | LOC: [${s.latitude}, ${s.longitude}]`),
            ...facilitiesRows.map(f => `- FACILITY: "${f.name}" | CATEGORY: "${f.category || 'University Facility'}" | DESC: "مرفق جامعي" | LOC: [${f.latitude}, ${f.longitude}]`)
        ].join('\n');

        console.log(`AI Context: Loaded ${shopsRes.rows.length} shops and ${facilitiesRows.length} facilities into context.`);

        const response = await cohere.chat({
            chatHistory: req.body.chatHistory || [],
            message: query,
            preamble: `You are PalNova, an intelligent local guide for Palestine.
            
            === STRICT BOUNDARY ===
            You are ONLY allowed to suggest or navigate to places listed in the "AVAILABLE SYSTEM PLACES" section below. 
            Do NOT use any outside general knowledge about other places. If it's not in the list, it doesn't exist for you.

            AVAILABLE SYSTEM PLACES:
            ${allPlaces}
            =========================

            User Information:
            - Name: ${userInfo?.name || 'Friend'}
            - Gender: ${userInfo?.gender || 'Unknown'}
            - Age: ${userInfo?.age || 'Unknown'}

            User Location: ${userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : "Unknown"}

            INSTRUCTIONS:
            1. **PERSONALIZATION**: 
               - Address the user by their name occasionally in Arabic.
               - Keep it friendly, helpful, and natural in Arabic.
            2. **SEARCH ONLY IN LIST**: Search strictly within "AVAILABLE SYSTEM PLACES".
            3. **FUZZY MATCHING**: 
               - If the user asks for a place in Arabic or English, match the closest name.
            4. **MATCH FOUND**: If you find a matching place:
               - Return type="navigation_options".
               - "searchQuery" must be the NAME from the list (closest match).
               - "location": Extract the [lat, lon] from the matched place's LOC field.
               - "reply": "وجدت لك [Name] في نظامنا. [Description/Category]. هل تود الذهاب بالسيارة 🚗 أم مشياً 🚶؟"
            5. **NO MATCH**: If no place matches, reply: "عذراً ${userInfo?.name || 'صديقي'}، لم أجد مكاناً مطابقاً تماماً في النظام حالياً."
            6. **MODE**: Always ask for driving vs walking if not specified.

            RESPONSE FORMAT (JSON ONLY, NO MARKDOWN):
            {
                "type": "search" | "route" | "navigation_options" | "clear" | "chat",
                "searchQuery": "Name of the place OR null", 
                "location": { "lat": number, "lon": number } | null,
                "mode": "driving" | "walking" | null,
                "reply": "Your helpful response in Arabic"
            }
            `
        });

        // Parse the JSON from the text property
        let jsonResponse;
        try {
            const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            jsonResponse = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse AI response:", response.text);
            jsonResponse = {
                type: 'chat',
                searchQuery: null,
                reply: response.text
            };
        }

        res.json(jsonResponse);

    } catch (error) {
        console.error('Cohere API Error, running local fallback search:', error?.message || error);
        try {
            const qClean = query.trim().replace(/[؟?!.]/g, '');
            const matchRes = await pool.query(
                `SELECT s.id, s.name, s.category, s.latitude, s.longitude, s.bio, 'shop' as result_type 
                 FROM shops s
                 WHERE s.is_hidden = FALSE AND (s.name ILIKE $1 OR s.category ILIKE $1 OR s.bio ILIKE $1)
                 UNION ALL
                 SELECT f.id, f.name, f.category, f.latitude, f.longitude, 'مرفق جامعي' as bio, 'facility' as result_type 
                 FROM university_facilities f
                 WHERE f.is_hidden = FALSE AND (f.name ILIKE $1 OR f.category ILIKE $1)
                 LIMIT 5`,
                [`%${qClean}%`]
            );

            if (matchRes.rows.length > 0) {
                const best = matchRes.rows[0];
                return res.json({
                    type: 'navigation_options',
                    searchQuery: best.name,
                    location: { lat: parseFloat(best.latitude), lon: parseFloat(best.longitude) },
                    mode: 'driving',
                    reply: `وجدت لك "${best.name}" (${best.category || 'مكان مميز'}). تم تحديد الموقع ويمكنك بدء التوجيه مباشرة!`,
                    results: matchRes.rows
                });
            }

            return res.json({
                type: 'chat',
                searchQuery: null,
                reply: 'أهلاً بك! يمكنك البحث عن أي محل أو مرفق جامعي أو السؤال عن طريق أو وجهة في الخريطة.',
                results: []
            });
        } catch (fallbackErr) {
            res.json({
                type: 'chat',
                searchQuery: null,
                reply: 'أهلاً بك في المساعد الذكي، كيف يمكنني مساعدتك اليوم؟',
                results: []
            });
        }
    }
};

exports.recognizeProducts = async (req, res) => {
    try {
        return res.json({ message: 'AI Product recognition completed', items: [] });
    } catch (error) {
        return res.status(500).json({ error: 'Recognition failed' });
    }
};

exports.generateDesign = async (req, res) => {
    try {
        return res.json({ message: 'Design generated', designUrl: null });
    } catch (error) {
        return res.status(500).json({ error: 'Design generation failed' });
    }
};
