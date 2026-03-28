import Joi from 'joi';

const PAYMENT_METHOD_VALUES = ['cash', 'upi'];

const orderItemSchema = Joi.object({
  menuItemId: Joi.string().uuid().optional(),
  itemId: Joi.string().uuid().optional(),
  id: Joi.string().uuid().optional(),
  name: Joi.string().trim().max(200).optional(),
  quantity: Joi.number().integer().min(1).max(100).optional(),
  qty: Joi.number().integer().min(1).max(100).optional(),
  price: Joi.number().positive().precision(2).optional(),
  unitPrice: Joi.number().positive().precision(2).optional(),
  specialInstructions: Joi.string().trim().max(200).optional(),
  itemNote: Joi.string().trim().max(200).optional().allow(''),
  note: Joi.string().trim().max(200).optional().allow(''),
  modifiers: Joi.array().items(Joi.string().trim().max(60)).max(10).optional(),
}).or('menuItemId', 'itemId', 'id').or('quantity', 'qty');

const paymentMethodSchema = Joi.string().trim().lowercase().valid(...PAYMENT_METHOD_VALUES);

export const createOrderSchema = Joi.object({
  tableId: Joi.string().uuid().optional().allow(null),
  table_id: Joi.string().uuid().optional().allow(null),
  qrCodeData: Joi.string().trim().optional(),
  tableNumber: Joi.number().integer().min(1).optional(),
  items: Joi.array()
    .items(orderItemSchema)
    .min(1)
    .required(),
  total: Joi.number().min(0).precision(2).optional(),
  totalAmount: Joi.number().min(0).precision(2).optional(),
  orderType: Joi.string().valid('dine-in', 'takeaway', 'delivery').optional(),
  order_type: Joi.string().valid('dine-in', 'takeaway', 'delivery').optional(),
  paymentMethod: paymentMethodSchema.optional(),
  payment_method: paymentMethodSchema.optional(),
  notes: Joi.string().trim().max(500).optional().allow(''),
});

export const updateOrderSchema = createOrderSchema;

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'preparing', 'ready', 'served', 'cancelled')
    .required(),
  cancelReason: Joi.string().trim().max(200).when('status', {
    is: 'cancelled',
    then: Joi.required(),
  }),
});

export const settleOrderSchema = Joi.object({
  paymentMethod: paymentMethodSchema.optional(),
  payment_method: paymentMethodSchema.optional(),
  amountReceived: Joi.number().min(0).precision(2).optional(),
  amount_received: Joi.number().min(0).precision(2).optional(),
  paymentNote: Joi.string().trim().max(200).optional().allow(''),
  payment_note: Joi.string().trim().max(200).optional().allow(''),
}).or('paymentMethod', 'payment_method');

export const updateKitchenTicketStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'preparing', 'ready', 'served')
    .required(),
});

export const cancelPendingBillsSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(200).required(),
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
