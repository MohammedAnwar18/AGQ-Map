const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/hellyController');

// كل المسارات للأدمن العام (الفحص داخل المتحكّم)
router.get('/', authenticateToken, ctrl.listSimulations);
router.post('/', authenticateToken, ctrl.createSimulation);
router.get('/:id', authenticateToken, ctrl.getSimulation);
router.post('/:id/step', authenticateToken, ctrl.stepSimulation);
router.post('/:id/inject', authenticateToken, ctrl.injectEvent);
router.post('/:id/report', authenticateToken, ctrl.buildReport);
router.post('/:id/agents/:agentId/chat', authenticateToken, ctrl.chatWithAgent);
router.delete('/:id', authenticateToken, ctrl.deleteSimulation);

module.exports = router;
