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
        // 1. Fetch Shops Context
        const shopsRes = await pool.query('SELECT id, name, bio, category, latitude, longitude FROM shops');
        const shops = shopsRes.rows.map(s =>
            `SHOP - ID: ${s.id} | NAME: "${s.name}" | CATEGORY: "${s.category || 'General'}" | DESC: "${s.bio || 'None'}" | LOC: [${s.latitude}, ${s.longitude}]`
        ).join('\n');

        // 2. Fetch Users Context (excluding current user possibly, but let's just fetch public info)
        const usersRes = await pool.query('SELECT id, full_name, username, bio FROM users LIMIT 100');
        const systemUsers = usersRes.rows.map(u =>
            `USER - ID: ${u.id} | NAME: "${u.full_name || u.username}" | USERNAME: "${u.username}" | BIO: "${u.bio || 'None'}"`
        ).join('\n');

        // 3. Fetch Posts Context (locations)
        const postsRes = await pool.query(`
            SELECT p.id, p.content, ST_Y(p.location::geometry) as latitude, ST_X(p.location::geometry) as longitude, u.full_name 
            FROM posts p JOIN users u ON p.user_id = u.id 
            LIMIT 50
        `);
        const posts = postsRes.rows.map(p =>
            `POST - ID: ${p.id} | BY: "${p.full_name}" | CONTENT: "${p.content}" | LOC: [${p.latitude}, ${p.longitude}]`
        ).join('\n');

        console.log(`AI Context Loaded: ${shopsRes.rows.length} shops, ${usersRes.rows.length} users, ${postsRes.rows.length} posts.`);

        const response = await cohere.chat({
            chatHistory: req.body.chatHistory || [],
            message: query,
            preamble: `You are PalNova, an intelligent local guide.
            
            === STRICT BOUNDARY ===
            You are ONLY allowed to suggest or talk about places, people, or posts listed in the "AVAILABLE SYSTEM DATA" section below. 
            Do NOT use any outside general knowledge. If it's not in the list, it doesn't exist for you.

            AVAILABLE SYSTEM DATA:
            --- SHOPS ---
            ${shops}
            --- USERS ---
            ${systemUsers}
            --- POSTS ---
            ${posts}
            =========================

            User Information:
            - Name: ${userInfo?.name || 'Friend'}
            - Gender: ${userInfo?.gender || 'Unknown'}
            - Age: ${userInfo?.age || 'Unknown'}

            User Location: ${userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : "Unknown"}

            INSTRUCTIONS:
            1. **جودة اللغة والأسلوب**: 
               - يجب أن يكون الرد باللغة العربية بأسلوب راقٍ، مرتب، وذكي.
               - اجعل الرد ملهماً ويثير فضول المستخدم لاستكشاف الأماكن المقترحة على الخريطة.
               - ممنوع تماماً: لا تضع أي أوامر برمجية، مصطلحات تقنية بالإنجليزية، أو استعلامات قاعدة بيانات داخل نص الـ "reply".
            2. **ذكر المحلات**: 
               - عند الحديث عن أي محل، يجب ذكر اسمه متبوعاً بتصنيفه (مثلاً: "مطعم [الاسم]" أو "[الاسم] من فئة [التصنيف]").
            3. **التخصيص**: 
               - خاطب المستخدم باسمه بشكل ودي وقريب.
            4. **البحث في البيانات المتاحة فقط**: ابحث بدقة داخل "AVAILABLE SYSTEM DATA". يمكنك الإجابة عن المحلات، المستخدمين، والمنشورات العامة.
            5. **حالة العثور على نتائج**: 
               - إذا طلب المستخدم محلاً معيناً: استخدم type="navigation_options".
               - إذا طلب فئة كاملة (مثل "مطاعم"): استخدم type="search_list".
            6. **حالة عدم وجود نتائج**: أخبر المستخدم بلباقة أنك متاح فقط للمساعدة في البيانات الموجودة حالياً على الخريطة.
            7. **تحديد وسيلة النقل**: اطلب دائماً تحديد (مشي أو سيارة) إذا لم يحدد المستخدم ذلك للوصول للمكان.

            RESPONSE FORMAT (JSON ONLY, NO MARKDOWN):
            {
                "type": "search" | "route" | "navigation_options" | "search_list" | "clear" | "chat",
                "searchQuery": "Name or null", 
                "location": { "lat": number, "lon": number } | null,
                "results": [ { "id": number, "name": "string", "category": "string", "location": { "lat": number, "lon": number } } ], 
                "mode": "driving" | "walking" | null,
                "reply": "ردك الذكي والملهم باللغة العربية"
            }
            `
        });

        // Parse the JSON from the text property
        let jsonResponse;
        try {
            // Cohere might return markdown code blocks, strip them
            const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            jsonResponse = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse AI response:", response.text);
            // Fallback
            jsonResponse = {
                type: 'chat',
                searchQuery: null,
                reply: response.text
            };
        }

        res.json(jsonResponse);

    } catch (error) {
        console.error('Cohere API Error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
};
