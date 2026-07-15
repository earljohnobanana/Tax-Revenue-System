/**
 * server/routes/delinquent.routes.js
 */
const express = require('express');
const router  = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { checkDelinquency, listDelinquent } = require('../controllers/delinquent.controller');

router.use(verifyToken);

router.get('/check', requireRole('Treasurer', 'Administrator', 'Super Admin'), checkDelinquency);
router.get('/',      requireRole('Treasurer', 'Administrator', 'Super Admin', 'Accounting Staff'), listDelinquent);

module.exports = router;