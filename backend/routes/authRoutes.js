import { Router } from 'express';
import { login, logout, me } from '../controllers/authController.js';
import { authenticateRequest } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/logout', authenticateRequest, logout);
router.get('/me', authenticateRequest, me);

export default router;
