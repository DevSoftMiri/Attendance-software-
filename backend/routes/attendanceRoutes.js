import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth.js';
import { checkIn, checkOut, history } from '../controllers/attendanceController.js';

const router = Router();

router.use(authenticateRequest);
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/history', history);

export default router;
