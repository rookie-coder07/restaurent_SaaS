import takeawayService from '../services/takeawayService.js';
import { sendSuccess } from '../utils/apiResponse.js';

const takeawayController = {
  createOrder: async (req, res) => {
    const order = await takeawayService.createOrder(req.restaurantId, req.body, {
      actorId: req.user.id,
      actorRole: req.user.role || 'manager',
    });
    return sendSuccess(res, 201, order);
  },

  settleOrder: async (req, res) => {
    const order = await takeawayService.settleOrder(
      req.restaurantId,
      req.params.orderId,
      req.body,
      { actorId: req.user.id, actorRole: req.user.role || 'manager' }
    );
    return sendSuccess(res, 200, order);
  },
};

export default takeawayController;
