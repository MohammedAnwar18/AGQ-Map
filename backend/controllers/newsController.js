const axios = require('axios');

const GNEWS_API_KEY = '59395bbc1181c3f2de15ff50b8d26092';

exports.getNews = async (req, res) => {
    try {
        const { lat, lon, query } = req.body;
        let searchQuery = query || 'World News';

        // If lat/lon provided, try to reverse geocode to get city/country
        if (lat && lon && !query) {
            try {
                // Using Nominatim for reverse geocoding (OpenStreetMap)
                // Important: Must provide a User-Agent
                const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
                const geoRes = await axios.get(geoUrl, {
                    headers: { 'User-Agent': 'SpatialSocialNetwork/1.0' }
                });

                if (geoRes.data && geoRes.data.address) {
                    const addr = geoRes.data.address;
                    // Prioritize City, then State, then Country
                    searchQuery = addr.city || addr.town || addr.municipality || addr.state || addr.country || 'Middle East';
                    console.log(`Detected location: ${searchQuery}`);

                    // Specific fix: If "West Bank" or similar, ensure we query relevant terms
                    if (searchQuery.includes('Palestin')) searchQuery = 'Palestine';
                }
            } catch (error) {
                console.error("Reverse geocoding failed:", error.message);
                // Fallback to general news if geo logic fails
            }
        }

        // Fetch news
        // lang=ar for Arabic news if possible, or enforce it. 
        // The user speaks Arabic, so let's try to fetch Arabic news if relevant, or English if not.
        // GNews supports 'lang' parameter. 
        const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(searchQuery)}&lang=ar&token=${GNEWS_API_KEY}&max=10`;

        console.log(`Fetching news for: ${searchQuery} - ${url}`);
        const newsRes = await axios.get(url);

        res.json({
            location: searchQuery,
            articles: newsRes.data.articles
        });

    } catch (error) {
        console.error("News fetch error:", error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
};

exports.createNews = async (req, res) => {
    try {
        return res.json({ message: 'News created successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to create news' });
    }
};
