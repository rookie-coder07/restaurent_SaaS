import Joi from 'joi';

// Restaurant registration - password is validated separately in controller
export const restaurantRegisterSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]{7,20}$/).required().messages({
    'string.pattern.base': 'Phone must be 7-20 digits (can include +, spaces, dashes, parentheses)'
  }),
  password: Joi.string().min(8).max(128).required(),
  city: Joi.string().trim().required(),
  address: Joi.string().trim().optional(),
  gstNumber: Joi.string().trim().optional(),
})
  .rename('restaurant_name', 'name', { ignoreUndefined: true, override: false })
  .rename('restaurantName', 'name', { ignoreUndefined: true, override: false });

// Staff registration - requires password confirmation
export const staffRegisterSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]{7,20}$/).required().messages({
    'string.pattern.base': 'Phone must be 7-20 digits (can include +, spaces, dashes, parentheses)'
  }),
  password: Joi.string().required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  role: Joi.string().valid('manager', 'kitchen_staff', 'staff').required(),
});

// Keep old schema for backward compatibility
export const registerSchema = restaurantRegisterSchema;

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
  portal: Joi.string().valid('admin', 'pos', 'kot', 'manager', 'developer').optional(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().required(),
});

export const requestPasswordResetSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  role: Joi.string().valid('owner', 'manager', 'staff', 'developer', 'pos', 'pos_staff').required(),
});

export const resetUserPasswordSchema = Joi.object({
  requestId: Joi.string().uuid().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
});

export const createStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().pattern(/^\d{10}$/).required(),
  password: Joi.string().required(),
  role: Joi.string().valid('manager', 'kitchen_staff', 'staff').required(),
  assignedTables: Joi.array().items(Joi.string().uuid()).default([]),
  allowTableReassign: Joi.boolean().optional(),
});

export const updateStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).optional(),
  email: Joi.string().email().lowercase().optional(),
  phone: Joi.string().pattern(/^\d{10}$/).optional(),
  password: Joi.string().optional(),
  role: Joi.string().valid('manager', 'kitchen_staff', 'staff').optional(),
  assignedTables: Joi.array().items(Joi.string().uuid()).optional(),
  allowTableReassign: Joi.boolean().optional(),
});
