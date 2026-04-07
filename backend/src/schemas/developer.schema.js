import Joi from 'joi';

export const updateRestaurantAccessSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').optional(),
  accessEnabled: Joi.boolean().optional(),
}).or('status', 'accessEnabled');

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').required(),
});

export const resetDeveloperUserPasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).max(128).required(),
});

export const updateMaintenanceSchema = Joi.object({
  enabled: Joi.boolean().required(),
  message: Joi.string().trim().max(240).allow('').default(''),
  restaurantId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).allow(null).optional(),
});

export const updateFeatureFlagSchema = Joi.object({
  featureKey: Joi.string().trim().valid('qr_ordering', 'inventory', 'analytics', 'notifications').required(),
  enabled: Joi.boolean().required(),
  restaurantId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).allow(null).optional(),
});

export const createBroadcastSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required(),
  message: Joi.string().trim().min(3).max(500).required(),
});
