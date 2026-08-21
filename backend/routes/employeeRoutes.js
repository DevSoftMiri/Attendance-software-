import { Router } from 'express';
import { authenticateRequest, requireRole } from '../middleware/auth.js';
import { createEmployee, deleteEmployee, getEmployee, listEmployees, updateEmployee } from '../controllers/employeeController.js';

const router = Router();

router.use(authenticateRequest);
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), listEmployees);
router.get('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), getEmployee);
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), createEmployee);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updateEmployee);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), deleteEmployee);

export default router;
