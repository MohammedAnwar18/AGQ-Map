const { CohereClient } = require('cohere-ai');

const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY || 'GOuJk1N4r63rU4GLDwJkHQ3QLIQvr1TBz5YdNBv8', // Fallback to provided key
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
            preamble: `You are PalNovaa, an intelligent local guide.
            
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
            1. **اللغة العربية المطلقة**: 
               - يجب أن يكون الرد باللغة العربية حصراً وبشكل أدبي، مرتب، وذكي.
               - **قاعدة ذهبية**: يمنع منعاً باتاً كتابة أي كلمة إنجليزية تقنية، أو استعلامات SQL، أو JSON داخل نص الـ "reply". لا تظهر "searchQuery" أو "location" داخل النص.
               - اجعل الرد يشعر المستخدم بالود والفضول لاستكشاف المكان.
            2. **ذكر المحل والفئة**: 
               - دائماً اذكر اسم المحل متبوعاً بتصنيفه (مثال: "مطعم القدس"، "تاكسي الوفاء"، "سوبر ماركت الزهراء").
            3. **تسهيل الوصول (أزرار التنقل)**: 
               - بمجرد تحديد المستخدم لمكان واحد أو الموافقة عليه، استخدم "type": "navigation_options" لكي تظهر له أزرار (سيارة / مشي) فوراً في الواجهة.
            4. **البيانات المتاحة**: اعتمد كلياً على "AVAILABLE SYSTEM DATA". إذا لم تجد المكان، اعتذر بلباقة وأخبره أنك مخصص للمعلومات الموجودة على الخريطة حالياً.

            RESPONSE FORMAT (JSON ONLY, NO MARKDOWN):
            {
                "type": "search" | "route" | "navigation_options" | "search_list" | "clear" | "chat",
                "searchQuery": "Name or null", 
                "location": { "lat": number, "lon": number } | null,
                "results": [ { "id": number, "name": "string", "category": "string", "location": { "lat": number, "lon": number } } ], 
                "mode": "driving" | "walking" | null,
                "reply": "نص الرد العربي الإبداعي والخالي تماماً من الإنجليزية والرموز البرمجية"
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
