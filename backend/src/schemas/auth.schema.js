import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().pattern(/^\d{10}$/).required(),
  password: Joi.string().required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  city: Joi.string().trim().required(),
  address: Joi.string().trim().optional(),
  gstNumber: Joi.string().trim().optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
});

export const createStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().pattern(/^\d{10}$/).required(),
  password: Joi.string().required(),
  role: Joi.string().valid('manager', 'kitchen_staff', 'staff').required(),
});
