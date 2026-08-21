import { Router } from 'express';
import { authenticateRequest, requireRole } from '../middleware/auth.js';
import { enrol, profile, quality, remove, verify } from '../controllers/faceController.js';

const router = Router();

router.use(authenticateRequest);
router.post('/enrol', requireRole('SUPER_ADMIN', 'ADMIN'), enrol);
router.post('/verify', verify);
router.post('/check-quality', requireRole('SUPER_ADMIN', 'ADMIN'), quality);
router.get('/:employeeId', requireRole('SUPER_ADMIN', 'ADMIN'), profile);
router.delete('/:employeeId', requireRole('SUPER_ADMIN', 'ADMIN'), remove);

export default router;
