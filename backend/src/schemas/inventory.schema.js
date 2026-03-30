import Joi from 'joi';

const INVENTORY_UNITS = ['kg', 'g', 'litre', 'ml', 'pieces'];
const ADJUSTMENT_ACTIONS = ['increase', 'decrease', 'set'];

const ingredientSchema = Joi.object({
  itemId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().precision(4).required(),
  unit: Joi.string().trim().lowercase().valid(...INVENTORY_UNITS).required(),
});

export const createInventoryItemSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  quantity: Joi.number().min(0).precision(4).required(),
  unit: Joi.string().trim().lowercase().valid(...INVENTORY_UNITS).required(),
  threshold: Joi.number().min(0).precision(4).required(),
});

export const updateInventoryItemSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  quantity: Joi.number().min(0).precision(4).optional(),
  unit: Joi.string().trim().lowercase().valid(...INVENTORY_UNITS).optional(),
  threshold: Joi.number().min(0).precision(4).optional(),
}).min(1);

export const addStockSchema = Joi.object({
  quantity: Joi.number().positive().precision(4).required(),
  reason: Joi.string().trim().max(200).optional().allow(''),
});

export const adjustStockSchema = Joi.object({
  action: Joi.string().trim().lowercase().valid(...ADJUSTMENT_ACTIONS).required(),
  quantity: Joi.number().min(0).precision(4).required(),
  reason: Joi.string().trim().max(200).optional().allow(''),
});

export const recipeSchema = Joi.array().items(ingredientSchema).max(50).optional().default([]);

