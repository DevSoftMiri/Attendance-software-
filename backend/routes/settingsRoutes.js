import { Router } from 'express';
import { authenticateRequest, requireRole } from '../middleware/auth.js';
import {
    createApprovedIpAddress,
    createBranch,
    createShift,
    deleteApprovedIpAddress,
    deleteBranch,
    deleteShift,
    getSettings,
    updateApprovedIpAddress,
    updateBranch,
    updateOrganisation,
    updateShift
} from '../controllers/settingsController.js';

const router = Router();

router.use(authenticateRequest);
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN'), getSettings);
router.put('/organisation', requireRole('SUPER_ADMIN', 'ADMIN'), updateOrganisation);
router.post('/shifts', requireRole('SUPER_ADMIN', 'ADMIN'), createShift);
router.patch('/shifts/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updateShift);
router.delete('/shifts/:id', requireRole('SUPER_ADMIN', 'ADMIN'), deleteShift);
router.post('/branches', requireRole('SUPER_ADMIN', 'ADMIN'), createBranch);
router.patch('/branches/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updateBranch);
router.delete('/branches/:id', requireRole('SUPER_ADMIN', 'ADMIN'), deleteBranch);
router.post('/approved-ip-addresses', requireRole('SUPER_ADMIN', 'ADMIN'), createApprovedIpAddress);
router.patch('/approved-ip-addresses/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updateApprovedIpAddress);
router.delete('/approved-ip-addresses/:id', requireRole('SUPER_ADMIN', 'ADMIN'), deleteApprovedIpAddress);

export default router;
