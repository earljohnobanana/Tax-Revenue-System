/**
 * server/routes/assessments.routes.js
 */
const express = require('express');
const router  = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  getAssessments,
  getPayableAssessmentsForOwner,
  previewComputeTax,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  cancelAssessment,
  listAssessments,
  getAssessment,
} = require('../controllers/assessments.controller');

router.use(verifyToken);

router.get('/payable',     requireRole('Treasurer', 'BPLO Staff', 'Administrator', 'Super Admin', 'Accounting Staff'), getPayableAssessmentsForOwner);
router.get('/preview-tax', requireRole('BPLO Staff', 'Treasurer', 'Administrator', 'Super Admin'), previewComputeTax);
router.get('/',            requireRole('BPLO Staff', 'Treasurer', 'Administrator', 'Super Admin', 'Accounting Staff', 'Viewer'), getAssessments);
router.get('/:id',         requireRole('BPLO Staff', 'Treasurer', 'Administrator', 'Super Admin', 'Accounting Staff', 'Viewer'), getAssessment);
router.post('/',           requireRole('BPLO Staff', 'Treasurer', 'Administrator', 'Super Admin'), createAssessment);
router.put('/:id',         requireRole('Treasurer', 'Administrator', 'Super Admin'), updateAssessment);
router.delete('/:id',      requireRole('Administrator', 'Super Admin'), deleteAssessment);
router.patch('/:id/cancel', requireRole('Treasurer', 'Administrator', 'Super Admin'), cancelAssessment);

module.exports = router;