import Joi from 'joi';

export const createMenuItemSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
  price: Joi.number().positive().precision(2).required(),
  preparationTime: Joi.number().integer().min(1).max(120).default(15),
  tags: Joi.array()
    .items(Joi.string())
    .optional()
    .default([]),
}).unknown(true);

export const updateMenuItemSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(500).optional(),
  price: Joi.number().positive().precision(2).optional(),
  preparationTime: Joi.number().integer().min(1).max(120).optional(),
  isAvailable: Joi.boolean().optional(),
  tags: Joi.array()
    .items(Joi.string())
    .optional(),
}).unknown(true);

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
  displayOrder: Joi.number().integer().min(0).default(0),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(500).optional(),
  displayOrder: Joi.number().integer().min(0).optional(),
});

export const toggleAvailabilitySchema = Joi.object({
  isAvailable: Joi.boolean().required(),
});
