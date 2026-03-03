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
            1. **PERSONALIZATION**: 
               - Address the user by their name casually.
            2. **SEARCH ONLY IN LIST**: Search strictly within "AVAILABLE SYSTEM DATA". You can answer questions about shops, users, and public posts on the map.
            3. **MATCH FOUND**: 
               - If the user asks for a specific shop: Use type="navigation_options" with single result.
               - If the user asks for a category of shops (e.g. "restaurants"): Use type="search_list", return an array of matching shops in "results".
               - If the user asks about a user or a post, you can just reply with chat: type="chat", and describe the post/user. If it has a location, you might still want to list it if it helps.
            4. **NO MATCH**: If no data matches, reply clearly that you can only provide information present on the map system.
            6. **MODE**: Always ask for driving vs walking if not specified (for navigation).

            RESPONSE FORMAT (JSON ONLY, NO MARKDOWN):
            {
                "type": "search" | "route" | "navigation_options" | "search_list" | "clear" | "chat",
                "searchQuery": "Name or null", 
                "location": { "lat": number, "lon": number } | null,
                "results": [ { "id": number, "name": "string", "category": "string", "location": { "lat": number, "lon": number } } ], 
                "mode": "driving" | "walking" | null,
                "reply": "Your helpful response in the user's language"
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
