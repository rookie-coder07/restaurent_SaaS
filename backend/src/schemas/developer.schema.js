import Joi from 'joi';

const featureKeySchema = Joi.string().trim().valid('loyalty', 'online_ordering', 'discounts', 'qr_ordering', 'inventory', 'analytics', 'notifications');

export const updateRestaurantAccessSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').optional(),
  accessEnabled: Joi.boolean().optional(),
}).or('status', 'accessEnabled');

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'disabled', 'banned').required(),
});

export const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('admin', 'manager', 'staff', 'kitchen_staff', 'developer').required(),
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
  featureKey: featureKeySchema.required(),
  enabled: Joi.boolean().required(),
  restaurantId: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).allow(null).optional(),
});

export const updateSystemSettingsSchema = Joi.object({
  globalTaxConfig: Joi.object({
    taxRate: Joi.number().min(0).max(100).required(),
    serviceChargeRate: Joi.number().min(0).max(100).default(0),
    taxLabel: Joi.string().trim().max(50).default('GST'),
  }).optional(),
  invoiceSettings: Joi.object({
    prefix: Joi.string().trim().max(12).required(),
    footer: Joi.string().trim().max(500).allow('').default(''),
    supportEmail: Joi.string().email().allow('').default(''),
  }).optional(),
  defaultConfigs: Joi.object({
    timezone: Joi.string().trim().max(80).required(),
    currency: Joi.string().trim().max(12).required(),
    orderAutoRefreshSeconds: Joi.number().integer().min(5).max(120).required(),
  }).optional(),
}).or('globalTaxConfig', 'invoiceSettings', 'defaultConfigs');

export const createBroadcastSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required(),
  message: Joi.string().trim().min(3).max(500).required(),
});

export const createDeveloperUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
  phone: Joi.string().trim().max(20).allow('').optional(),
});

export const createRestaurantSchema = Joi.object({
  restaurantName: Joi.string().trim().min(2).max(120).required(),
  ownerName: Joi.string().trim().min(2).max(120).required(),
  ownerEmail: Joi.string().email().trim().lowercase().required(),
  phone: Joi.string().trim().min(7).max(20).required(),
  address: Joi.string().trim().max(500).allow('').optional(),
  gstNumber: Joi.string().trim().max(50).allow('').optional(),
});

