const axios = require('axios');
const pool = require('../config/database');

exports.processQuery = async (req, res) => {
    const { query, userLocation, userInfo, chatHistory } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        // 1. Fetch Shops Context
        const shopsRes = await pool.query('SELECT id, name, bio, category, latitude, longitude FROM shops');
        const shops = shopsRes.rows.map(s =>
            `SHOP - ID: ${s.id} | NAME: "${s.name}" | CATEGORY: "${s.category || 'General'}" | DESC: "${s.bio || 'None'}" | LOC: [{"lat":${s.latitude}, "lon":${s.longitude}}]`
        ).join('\n');

        // 2. Fetch Users Context
        const usersRes = await pool.query('SELECT id, full_name, username, bio FROM users LIMIT 100');
        const systemUsers = usersRes.rows.map(u =>
            `USER - ID: ${u.id} | NAME: "${u.full_name || u.username}" | USERNAME: "${u.username}" | BIO: "${u.bio || 'None'}"`
        ).join('\n');

        // 3. Fetch Posts Context
        const postsRes = await pool.query(`
            SELECT p.id, p.content, ST_Y(p.location::geometry) as latitude, ST_X(p.location::geometry) as longitude, u.full_name 
            FROM posts p JOIN users u ON p.user_id = u.id 
            LIMIT 50
        `);
        const posts = postsRes.rows.map(p =>
            `POST - ID: ${p.id} | BY: "${p.full_name}" | CONTENT: "${p.content}" | LOC: [{"lat":${p.latitude}, "lon":${p.longitude}}]`
        ).join('\n');

        console.log(`AI Context Loaded: ${shopsRes.rows.length} shops, ${usersRes.rows.length} users, ${postsRes.rows.length} posts.`);

        const systemPrompt = `أنت PalNovaa، دليل محلي ذكي ومساعد ملاحي.

=== حدود صارمة للبيانات ===
يُسمح لك فقط باقتراح أو ذكر الأماكن والأشخاص والمنشورات المدرجة في "البيانات المتاحة" أدناه. لا تستخدم أي معرفة عامة خارجية مطلقاً. إذا لم يكن المكان موجوداً في القائمة، اعتذر بلباقة وأخبر المستخدم أنه غير متوفر في الخريطة.

البيانات المتاحة:
--- المحلات (SHOPS) ---
${shops}
--- المستخدمين (USERS) ---
${systemUsers}
--- المنشورات (POSTS) ---
${posts}
=========================

معلومات المستخدم الحالي:
- الاسم: ${userInfo?.name || 'صديق'}
- الموقع الحالي: ${userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : "غير معروف"}

تعليمات هامة جداً:
1. الرد باللغة العربية (reply): يجب أن يكون النص الموجه للمستخدم باللغة العربية، أدبياً، وودياً، ولا يحتوي على أي أكواد، رموز تقنية، استعلامات SQL أو إشارات لأسماء حقول البرمجة (مثل search أو location).
2. استخراج المعلومات بدقة: قم بتحليل طلب المستخدم وبناءً عليه ابحث في "البيانات المتاحة". عند التحدث عن محل، اذكر اسمه والفئة الخاصة به (مثال: مطعم القدس).
3. رسم المسار الملاحي بدقة (Routing): 
   - إذا طلب المستخدم الذهاب لمكان، أو توجيهه إليه، وكان المكان موجوداً في البيانات المتاحة، يجب تعيين "type" إلى "route" أو "navigation_options".
   - يجب إرفاق إحداثيات المكان الصحيحة في الحقل "location" تماماً كما هي في البيانات المتاحة {"lat": number, "lon": number}.
   - إذا طلب المشي أو السيارة، عيّن "mode" إلى "walking" أو "driving" على التوالي.
4. الرد حصراً بصيغة JSON: استجابتك بالكامل يجب أن تكون كائن JSON واحد صالح للتحليل الفوري ولا يوجد قبله أو بعده نص عادي.

الصيغة المطلوبة (JSON ONLY):
{
    "type": "search" | "route" | "navigation_options" | "search_list" | "clear" | "chat",
    "searchQuery": "Name or null", 
    "location": { "lat": number, "lon": number } | null,
    "results": [ { "id": number, "name": "string", "category": "string", "location": { "lat": number, "lon": number } } ], 
    "mode": "driving" | "walking" | null,
    "reply": "نص الرد العربي الإبداعي والخالي تماماً من الإنجليزية والرموز البرمجية"
}
`;

        let messages = [
            { role: "system", content: systemPrompt }
        ];

        if (chatHistory && Array.isArray(chatHistory)) {
            chatHistory.forEach(msg => {
                if (msg.role && msg.message) {
                    messages.push({
                        role: msg.role.toLowerCase() === "user" ? "user" : "assistant",
                        content: msg.message
                    });
                }
            });
        }
        
        messages.push({ role: "user", content: query });

        const sambaApiKey = process.env.SAMBANOVA_API_KEY;

        if (!sambaApiKey) {
            console.error('SAMBANOVA_API_KEY is not defined in the environment variables.');
            return res.status(500).json({ error: 'AI Assistant is currently unavailable due to missing configuration.' });
        }

        const response = await axios.post('https://api.sambanova.ai/v1/chat/completions', {
            model: "Meta-Llama-3.1-70B-Instruct",
            messages: messages,
            temperature: 0.1,
            top_p: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${sambaApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const replyContent = response.data.choices[0].message.content;

        let jsonResponse;
        try {
            const text = replyContent.replace(/\`\`\`json/gi, '').replace(/\`\`\`/gi, '').trim();
            jsonResponse = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse AI response from SambaNova:", replyContent);
            jsonResponse = {
                type: 'chat',
                searchQuery: null,
                reply: replyContent
            };
        }

        res.json(jsonResponse);

    } catch (error) {
        console.error('SambaNova API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to process request' });
    }
};
