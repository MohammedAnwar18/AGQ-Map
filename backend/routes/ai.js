const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../middleware/auth'); // Optional: if you want to protect it

// Allow unauthenticated access for now as per "run everything" ease, 
// or protect if the user is logged in (Map.jsx checks auth so we should likely expect a token if we use the same axios instance)
// Let's assume protected properly since the rest of the app is.
router.post('/chat', aiController.processQuery);

module.exports = router;
