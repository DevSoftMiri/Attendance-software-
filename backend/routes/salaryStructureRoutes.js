import { Router } from 'express';
import { authenticateRequest, requireRole } from '../middleware/auth.js';
import { createSalaryStructure, listSalaryStructures, updateSalaryStructure } from '../controllers/salaryStructureController.js';

const router = Router();

router.use(authenticateRequest);
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN'), listSalaryStructures);
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), createSalaryStructure);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updateSalaryStructure);

export default router;

