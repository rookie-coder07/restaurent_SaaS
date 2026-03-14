import Joi from 'joi';

const orderItemSchema = Joi.object({
  menuItemId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).max(100).required(),
  specialInstructions: Joi.string().trim().max(200).optional(),
});

export const createOrderSchema = Joi.object({
  tableId: Joi.string().uuid().required(),
  qrCodeData: Joi.string().trim().optional(),
  items: Joi.array()
    .items(orderItemSchema)
    .min(1)
    .required(),
  notes: Joi.string().trim().max(500).optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'preparing', 'ready', 'served', 'cancelled')
    .required(),
  cancelReason: Joi.string().trim().max(200).when('status', {
    is: 'cancelled',
    then: Joi.required(),
  }),
});

export const createTableSchema = Joi.object({
  tableNumber: Joi.number().integer().min(1).required(),
  seatCapacity: Joi.number().integer().min(1).max(20).required(),
  location: Joi.string().trim().max(100).optional(),
});

export const batchCreateTablesSchema = Joi.object({
  tables: Joi.array()
    .items(
      Joi.object({
        tableNumber: Joi.number().integer().min(1).required(),
        seatCapacity: Joi.number().integer().min(1).max(20).required(),
        location: Joi.string().trim().optional(),
      })
    )
    .min(1)
    .required(),
});

export const reserveTableSchema = Joi.object({
  reservedBy: Joi.string().trim().min(2).max(100).required(),
  reservationTime: Joi.date().iso().required(),
});
