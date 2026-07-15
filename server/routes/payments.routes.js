/**
 * server/routes/payments.routes.js
 */
const express = require('express');
const router  = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  recordPayment,
  deletePayment,
  listPayments,
  getPayment,
} = require('../controllers/payments.controller');

router.use(verifyToken);

router.get('/',    requireRole('Treasurer', 'Administrator', 'Super Admin', 'Accounting Staff', 'Viewer'), listPayments);
router.get('/:id', requireRole('Treasurer', 'Administrator', 'Super Admin', 'Accounting Staff', 'Viewer'), getPayment);
router.post('/',   requireRole('Treasurer', 'Administrator', 'Super Admin', 'Accounting Staff'), recordPayment);
router.delete('/:id', requireRole('Administrator', 'Super Admin'), deletePayment);

module.exports = router;