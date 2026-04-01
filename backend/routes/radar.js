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

        const flights = (data.ac || []).map(a => ({
            icao24: a.hex,
            callsign: (a.flight || '').trim() || 'مجهول',
            type: a.t || 'طائرة عسكرية',
            heading: a.track || 0,
            lat: a.lat,
            lon: a.lon,
            altitude: a.alt_baro === 'ground' ? 0 : (a.alt_baro || 0),
            speed: a.gs || 0,
            squawk: a.squawk || ''
        })).filter(f => f.lat && f.lon);

        res.json({ flights });
    } catch (err) {
        res.json({ flights: [] });
    }
});

// OSINT Naval Ships & Submarines
router.get('/ships', (req, res) => {
    const knownDeployments = [
        { name: 'USS Bataan', hull: 'LHD-5', type: 'Ship', class: 'Wasp-class', navy: 'US Navy', lat: 26.1, lon: 50.5, status: 'Deployed', region: 'Persian Gulf' },
        { name: 'USS Mason', hull: 'DDG-87', type: 'Ship', class: 'Arleigh Burke', navy: 'US Navy', lat: 14.5, lon: 42.8, status: 'Active', region: 'Red Sea' },
        { name: 'USS Florida', hull: 'SSGN-728', type: 'Submarine', class: 'Ohio-class', navy: 'US Navy', lat: 26.5, lon: 56.2, status: 'Deployed', region: 'Strait of Hormuz' },
        { name: 'HMS Diamond', hull: 'D34', type: 'Ship', class: 'Type 45', navy: 'Royal Navy', lat: 14.2, lon: 42.5, status: 'Active', region: 'Red Sea' },
        { name: 'INS Magen', hull: 'Sa\'ar 6', type: 'Ship', class: 'Sa\'ar 6', navy: 'Israeli Navy', lat: 32.8, lon: 34.5, status: 'Patrol', region: 'Eastern Med' },
        { name: 'INS Dolphin', hull: 'Submarine', type: 'Submarine', class: 'Dolphin', navy: 'Israeli Navy', lat: 31.5, lon: 33.8, status: 'Patrol', region: 'Eastern Med' },
        { name: 'IRIS Makran', hull: 'Base', type: 'Ship', class: 'Makran', navy: 'Iran Navy', lat: 25.4, lon: 57.5, status: 'Active', region: 'Strait of Hormuz' },
        { name: 'IRIS Sahand', hull: 'F-74', type: 'Ship', class: 'Moudge', navy: 'Iran Navy', lat: 27.1, lon: 56.3, status: 'Active', region: 'Persian Gulf' },
        { name: 'HMS Al Riyadh', hull: 'F-3000S', type: 'Ship', class: 'Al Riyadh', navy: 'Saudi Navy', lat: 20.5, lon: 39.8, status: 'Patrol', region: 'Red Sea' }
    ];
    res.json({ ships: knownDeployments });
});

module.exports = router;
