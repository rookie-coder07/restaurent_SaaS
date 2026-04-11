import { Router } from 'express';
import takeawayController from '../controllers/takeawayController.js';
import { authMiddleware } from '../middleware/auth.js';
import SecurityAuditLogger from '../utils/securityAudit.js';

const router = Router();

router.use(authMiddleware);

router.post('/', async (req, res, next) => {
  try {
    // ✅ Call controller
    await takeawayController.createOrder(req, res, next);
    
    // ✅ Log data access if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logDataAccess(
        req.user?.id || 'unknown',
        'takeaway_orders',
        'create',
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});

router.post('/:orderId/settle', async (req, res, next) => {
  try {
    // ✅ Call controller
    await takeawayController.settleOrder(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'takeaway_order_settlement',
        {
          orderId: req.params.orderId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});

export default router;
