const express = require('express');
const router = express.Router();

// Proxy for Israeli Alerts (Tzeva Adom)
router.get('/alerts', async (req, res) => {
    try {
        const response = await fetch('https://api.tzevaadom.co.il/notifications', {
            headers: { 'User-Agent': 'AGQ-Map/1.0', 'Accept': 'application/json' }
        });
        if (!response.ok) return res.json({ alerts: [] });
        const data = await response.json();
        
        // Ensure data is array
        const rawAlerts = Array.isArray(data) ? data : [];
        const alerts = rawAlerts.map((alert, i) => ({
            id: i,
            time: alert.date || new Date().toISOString(),
            threat: alert.title || 'إنذار عاجل',
            locations: Array.isArray(alert.cities) ? alert.cities : [alert.data || 'غير معروف']
        }));

        res.json({ alerts });
    } catch (err) {
        console.error("Alerts proxy error:", err);
        res.json({ alerts: [] }); // Graceful fallback
    }
});

// Proxy for Military Flights (ADSB.lol)
router.get('/flights', async (req, res) => {
    try {
        const response = await fetch('https://api.adsb.lol/v2/mil', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
        });
        
        if (!response.ok) return res.json({ flights: [] });
        const data = await response.json();

        // Map and filter ADSB data
        const flights = (data.ac || []).map(a => ({
            icao24: a.hex,
            callsign: (a.flight || '').trim() || 'مجهول',
            type: a.t || 'طائرة عسكرية',
            heading: a.track || 0,
            lat: a.lat,
            lon: a.lon,
            altitude: a.alt_baro === 'ground' ? 0 : (a.alt_baro || 0),
            speed: a.gs || 0
        })).filter(f => f.lat && f.lon); // Only aircraft with coordinates

        res.json({ flights });
    } catch (err) {
        console.error("Flights proxy error:", err);
        res.json({ flights: [] }); // Graceful fallback
    }
});

module.exports = router;
