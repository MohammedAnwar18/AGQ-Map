const axios = require('axios');
const pool = require('../config/database');

exports.processQuery = async (req, res) => {
    const { query, userLocation, userInfo, chatHistory } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        // 1. Fetch Shops & Products Context (Enhanced for Product Awareness)
        const shopsRes = await pool.query(`
            SELECT s.id, s.name, s.bio, s.category, s.latitude, s.longitude,
                   (SELECT json_agg(json_build_object('name', p.name, 'price', p.price))
                    FROM (SELECT name, price FROM shop_products WHERE shop_id = s.id LIMIT 8) p) as top_products
            FROM shops s 
            WHERE s.is_hidden = FALSE
        `);
        const shops = shopsRes.rows.map(s => {
            const productsStr = s.top_products ? s.top_products.map(p => `${p.name} (${p.price}₪)`).join(', ') : 'No products listed';
            return `SHOP - ID: ${s.id} | NAME: "${s.name}" | CATEGORY: "${s.category || 'General'}" | PRODUCTS: [${productsStr}] | LOC: [{"lat":${s.latitude}, "lon":${s.longitude}}]`;
        }).join('\n');

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
1. الرد باللغة العربية (reply): يجب أن يكون النص الموجه للمستخدم باللغة العربية، أدبياً، وودياً. لا تستخدم أي أكواد، رموز تقنية، أو استعلامات SQL. **يُمنع منعاً باتاً ذكر الإحداثيات (latitude و longitude) أو أرقام المواقع في النص. لا تقم أبداً بكتابة الإحداثيات في ردك.**
2. استخراج المعلومات بدقة: قم بتحليل طلب المستخدم وبناءً عليه ابحث في "البيانات المتاحة". عند التحدث عن محل، اذكر اسمه والفئة الخاصة به (مثال: مطعم القدس).
3. رسم المسار الملاحي بدقة (Routing): 
   - إذا طلب المستخدم الذهاب لمكان، أو توجيهه إليه، وكان المكان موجوداً في البيانات المتاحة، يجب تعيين "type" إلى "navigation_options".
   - **هام جداً:** عند استخدام "navigation_options" للتوجه نحو محل، يجب دائماً وضع بيانات المحل في مصفوفة "results" لكي يتمكن المستخدم من متابعته على الشاشة.
   - يجب إرفاق إحداثيات المكان الصحيحة في الحقل "location" تماماً كما هي في البيانات المتاحة {"lat": number, "lon": number}.
   - إذا طلب المشي أو السيارة مباشرة بدون استفسار إضافي، عيّن "mode" إلى "walking" أو "driving" واستخدم type="route".
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
            model: "Meta-Llama-3.3-70B-Instruct",
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
        
        // Handle Rate Limit Exceeded explicitly
        if (error.response?.data?.error?.type === 'rate_limit_exceeded' || error.response?.status === 429) {
            return res.status(429).json({ error: 'تم تجاوز الحد المسموح به للطلبات المجانية في خادم الذكاء الاصطناعي (SambaNova). يرجى المحاولة لاحقاً بعد قليل.' });
        }
        
        res.status(500).json({ error: 'Failed to process request' });
    }
};

/**
 * Recognize products from an image and match them with shop products
 */
exports.recognizeProducts = async (req, res) => {
    try {
        const { image, shopId, products: providedProducts } = req.body;

        if (!image || !shopId) {
            return res.status(400).json({ error: 'Image and shopId are required' });
        }

        // 1. Fetch products from database if not provided or to ensure accuracy
        let products = providedProducts;
        if (!products || products.length === 0) {
            const prodRes = await pool.query('SELECT * FROM shop_products WHERE shop_id = $1', [shopId]);
            products = prodRes.rows;
        }

        if (!products || products.length === 0) {
            return res.json({
                success: true,
                detected: [],
                total: 0,
                message: 'لا توجد منتجات مسجلة لهذا المحل للمقارنة معها.'
            });
        }

        // 2. STRICTOR OCR-BASED MATCHING
        // We now use the REAL text from the user's camera (ocrText)
        let ocrText = req.body.ocrText || "";
        
        console.log("Processing Real OCR Text:", ocrText);

        const sambaApiKey = process.env.SAMBANOVA_API_KEY;
        const productListStr = products.map(p => `ID: ${p.id} | Name: ${p.name}`).join('\n');

        const aiMatchPrompt = `
        You are an AI Product Recognition System.
        The user's camera has read the following text from a product: "${ocrText}"
        
        INVENTORY LIST IN THIS SHOP:
        ${productListStr}
        
        TASK:
        1. Identify which items from the INVENTORY LIST match the text from the camera.
        2. If the camera text is empty or incomplete, try to guess based on the most iconic shop products.
        3. Match the ID(s).
        4. Return ONLY a JSON array of the matching IDs.
        5. If NO match at all (not in inventory), return [].

        OUTPUT format: Only return the JSON array.
        `;

        let detectedIds = [];
        try {
            if (sambaApiKey) {
                const response = await axios.post('https://api.sambanova.ai/v1/chat/completions', {
                    model: "Meta-Llama-3.3-70B-Instruct",
                    messages: [{ role: "user", content: aiMatchPrompt }],
                    temperature: 0.1
                }, {
                    headers: { 'Authorization': `Bearer ${sambaApiKey}`, 'Content-Type': 'application/json' }
                });

                const content = response.data.choices[0].message.content;
                const match = content.match(/\[.*\]/s);
                if (match) {
                    detectedIds = JSON.parse(match[0]);
                }
            } else {
                // For demo if no API key
                detectedIds = products.length > 0 ? [products[0].id] : [];
            }
        } catch (aiErr) {
            console.error('AI Matching failed:', aiErr.message);
            detectedIds = [];
        }

        // 3. Final construction
        const detected = products.filter(p => detectedIds.includes(p.id)).map(p => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            image_url: p.image_url
        }));

        const total = parseFloat(detected.reduce((sum, item) => sum + item.price, 0).toFixed(2));

        res.json({
            success: true,
            detected,
            total,
            message: detected.length > 0 
                ? `تم التعرف على المنتج بنجاح.` 
                : 'لم نجد هذا المنتج في قائمة المحل.'
        });

    } catch (error) {
        console.error('Recognition Error:', error);
        res.status(500).json({ error: 'Failed to recognize products' });
    }
};
