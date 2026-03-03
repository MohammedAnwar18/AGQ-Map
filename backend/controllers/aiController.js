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
        // 1. Fetch Shops Context directly from DB
        const shopsRes = await pool.query('SELECT id, name, bio, category, latitude, longitude FROM shops');
        const shops = shopsRes.rows.map(s =>
            `- ID: ${s.id} | NAME: "${s.name}" | CATEGORY: "${s.category || 'General'}" | DESC: "${s.bio || 'None'}" | LOC: [${s.latitude}, ${s.longitude}]`
        ).join('\n');

        console.log(`AI Context: Loaded ${shopsRes.rows.length} shops into context.`);

        const response = await cohere.chat({
            chatHistory: req.body.chatHistory || [],
            message: query,
            preamble: `You are PalNova, an intelligent local guide.
            
            === STRICT BOUNDARY ===
            You are ONLY allowed to suggest or navigate to places listed in the "AVAILABLE SYSTEM SHOPS" section below. 
            Do NOT use any outside general knowledge about other places. If it's not in the list, it doesn't exist for you.

            AVAILABLE SYSTEM SHOPS:
            ${shops}
            =========================

            User Information:
            - Name: ${userInfo?.name || 'Friend'}
            - Gender: ${userInfo?.gender || 'Unknown'}
            - Age: ${userInfo?.age || 'Unknown'}

            User Location: ${userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : "Unknown"}

            INSTRUCTIONS:
            1. **PERSONALIZATION**: 
               - Address the user by their name occasionally.
               - Adapt your tone slightly based on their age (e.g., more energetic for youth, more formal for older adults), but keep it comfortably professional.
               - Use appropriate gender pronouns if clear, but avoid over-gendering unless necessary in Arabic.
            2. **SEARCH ONLY IN LIST**: Search strictly within "AVAILABLE SYSTEM SHOPS".
            3. **FUZZY MATCHING**: 
               - If the user asks for "Qatanna Shop" and you have "قطنة شوب", that is a MATCH. 
               - If the shop has DESC: "None", infer what it is from its NAME and CATEGORY.
            4. **MATCH FOUND**: 
               - If the user asks for a specific place and you find it: Use type="navigation_options" with single result.
               - If the user asks for a category (e.g. "restaurants", "shops near me") or multiple options: Use type="search_list".
               - For "search_list", return an array of matching shops in "results".
               - "reply": "Here are the [Category] I found:"

            5. **NO MATCH**: If no shop matches, reply: "Sorry [Name], I can only help with shops registered in our system."
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
