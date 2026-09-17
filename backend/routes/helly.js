const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/hellyController');
const spatial = require('../controllers/hellySpatialController');

// كل المسارات للأدمن العام (الفحص داخل المتحكّم)
router.get('/', authenticateToken, ctrl.listSimulations);
router.post('/', authenticateToken, ctrl.createSimulation);

// الطبقة المكانية — قبل مسارات /:id حتى لا تلتقطها كمعرّف
router.post('/osm/probe', authenticateToken, spatial.probeSpatial);
router.post('/osm/street', authenticateToken, spatial.captureStreet);
router.get('/osm/search', authenticateToken, spatial.searchPlace);

router.get('/:id', authenticateToken, ctrl.getSimulation);
router.get('/:id/forecast', authenticateToken, spatial.forecast);
router.post('/:id/step', authenticateToken, ctrl.stepSimulation);
router.post('/:id/inject', authenticateToken, ctrl.injectEvent);
router.post('/:id/report', authenticateToken, ctrl.buildReport);
router.post('/:id/agents/:agentId/chat', authenticateToken, ctrl.chatWithAgent);
router.delete('/:id', authenticateToken, ctrl.deleteSimulation);

module.exports = router;
