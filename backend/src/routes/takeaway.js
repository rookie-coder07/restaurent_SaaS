import { Router } from 'express';
import takeawayController from '../controllers/takeawayController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.post('/', takeawayController.createOrder);
router.post('/:orderId/settle', takeawayController.settleOrder);

export default router;
