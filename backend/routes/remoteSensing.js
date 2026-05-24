const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/aster30m', async (req, res) => {
    try {
        const { locations } = req.query;
        if (!locations) {
            return res.status(400).json({ error: "Locations query parameter is required" });
        }

        const url = `https://api.opentopodata.org/v1/aster30m?locations=${locations}`;
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error("Remote Sensing Proxy Error:", error.message);
        res.status(error.response?.status || 500).json({
            error: error.message || "Failed to fetch remote sensing data",
            details: error.response?.data || undefined
        });
    }
});

module.exports = router;
