import Joi from 'joi';

export const updateRestaurantSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional(),
  phone: Joi.string().pattern(/^\d{10}$/).optional(),
  address: Joi.string().trim().optional(),
  city: Joi.string().trim().optional(),
  gstNumber: Joi.string().trim().optional(),
  timezone: Joi.string().optional(),
});

export const updateRestaurantSettingsSchema = Joi.object({
  enableGST: Joi.boolean().optional(),
  defaultGSTPercent: Joi.number().min(0).max(100).optional(),
  defaultCGSTPercent: Joi.number().min(0).max(100).optional(),
  defaultSGSTPercent: Joi.number().min(0).max(100).optional(),
  defaultServiceCharge: Joi.number().min(0).max(100000).precision(2).optional(),
  currency: Joi.string().valid('INR', 'USD').default('INR'),
  printProvider: Joi.string().valid('browser', 'qz', 'local_service').optional(),
  printServiceUrl: Joi.string().uri({ allowRelative: false }).allow('', null).optional(),
  receiptWidthMm: Joi.number().valid(58, 80).optional(),
  autoPrintKOT: Joi.boolean().optional(),
  autoPrintBill: Joi.boolean().optional(),
  billPrinter: Joi.object({
    name: Joi.string().trim().max(120).allow('').default(''),
    enabled: Joi.boolean().default(false),
  }).optional(),
  kotPrinters: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().max(120).allow('').default(''),
      enabled: Joi.boolean().default(true),
    })
  ).max(10).optional(),
});

export const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0).default(0),
});
