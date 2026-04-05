import Joi from 'joi';

const PAYMENT_METHOD_VALUES = ['cash', 'upi'];
const ONLINE_SOURCE_VALUES = ['direct', 'phone', 'website', 'swiggy', 'zomato'];
const ONLINE_WORKFLOW_VALUES = ['new', 'accepted', 'rejected', 'preparing', 'ready', 'dispatched'];
const ONLINE_PAYMENT_STATE_VALUES = ['pending', 'paid', 'cash_on_delivery', 'failed', 'refunded'];

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
const tableLabelSchema = Joi.string().trim().max(30).pattern(/^[A-Za-z0-9][A-Za-z0-9\s-]*$/);

export const createOrderSchema = Joi.object({
  tableId: Joi.string().uuid().optional().allow(null),
  table_id: Joi.string().uuid().optional().allow(null),
  qrCodeData: Joi.string().trim().optional(),
  tableNumber: tableLabelSchema.optional(),
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
  source: Joi.string().trim().lowercase().valid(...ONLINE_SOURCE_VALUES).optional().allow(null),
  promisedAt: Joi.date().iso().optional().allow(null),
  promised_at: Joi.date().iso().optional().allow(null),
  paymentState: Joi.string().trim().lowercase().valid(...ONLINE_PAYMENT_STATE_VALUES).optional().allow(null),
  payment_state: Joi.string().trim().lowercase().valid(...ONLINE_PAYMENT_STATE_VALUES).optional().allow(null),
  customerName: Joi.string().trim().max(120).optional().allow(''),
  customer_name: Joi.string().trim().max(120).optional().allow(''),
  customerPhone: Joi.string().trim().max(30).optional().allow(''),
  customer_phone: Joi.string().trim().max(30).optional().allow(''),
  customerAddress: Joi.string().trim().max(300).optional().allow(''),
  customer_address: Joi.string().trim().max(300).optional().allow(''),
  channelOrderId: Joi.string().trim().max(120).optional().allow(''),
  channel_order_id: Joi.string().trim().max(120).optional().allow(''),
});

export const updateOrderSchema = createOrderSchema;

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'cancelled')
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
  discountPercent: Joi.number().min(0).max(100).precision(2).optional(),
  discount_percent: Joi.number().min(0).max(100).precision(2).optional(),
  paymentNote: Joi.string().trim().max(200).optional().allow(''),
  payment_note: Joi.string().trim().max(200).optional().allow(''),
  loyaltyPhone: Joi.string().trim().max(30).optional().allow(''),
  loyalty_phone: Joi.string().trim().max(30).optional().allow(''),
  redeemPoints: Joi.number().integer().min(0).max(100000).optional(),
  redeem_points: Joi.number().integer().min(0).max(100000).optional(),
}).or(
  'paymentMethod',
  'payment_method',
  'discountPercent',
  'discount_percent',
  'loyaltyPhone',
  'loyalty_phone',
  'redeemPoints',
  'redeem_points'
);

export const approveDiscountSchema = Joi.object({
  percent: Joi.number().greater(0).max(100).precision(2).required(),
  note: Joi.string().trim().max(200).optional().allow(''),
});

export const updateOnlineOrderSchema = Joi.object({
  workflowStatus: Joi.string().trim().lowercase().valid(...ONLINE_WORKFLOW_VALUES).optional(),
  workflow_status: Joi.string().trim().lowercase().valid(...ONLINE_WORKFLOW_VALUES).optional(),
  promisedAt: Joi.date().iso().optional().allow(null),
  promised_at: Joi.date().iso().optional().allow(null),
  paymentState: Joi.string().trim().lowercase().valid(...ONLINE_PAYMENT_STATE_VALUES).optional().allow(null),
  payment_state: Joi.string().trim().lowercase().valid(...ONLINE_PAYMENT_STATE_VALUES).optional().allow(null),
  source: Joi.string().trim().lowercase().valid(...ONLINE_SOURCE_VALUES).optional().allow(null),
  customerName: Joi.string().trim().max(120).optional().allow(''),
  customer_name: Joi.string().trim().max(120).optional().allow(''),
  customerPhone: Joi.string().trim().max(30).optional().allow(''),
  customer_phone: Joi.string().trim().max(30).optional().allow(''),
  customerAddress: Joi.string().trim().max(300).optional().allow(''),
  customer_address: Joi.string().trim().max(300).optional().allow(''),
  channelOrderId: Joi.string().trim().max(120).optional().allow(''),
  channel_order_id: Joi.string().trim().max(120).optional().allow(''),
}).or(
  'workflowStatus',
  'workflow_status',
  'promisedAt',
  'promised_at',
  'paymentState',
  'payment_state',
  'source',
  'customerName',
  'customer_name',
  'customerPhone',
  'customer_phone',
  'customerAddress',
  'customer_address',
  'channelOrderId',
  'channel_order_id'
);

export const updateKitchenTicketStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'preparing', 'ready', 'served')
    .required(),
});

export const cancelPendingBillsSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(200).required(),
});

export const softDeleteOrderSchema = Joi.object({
  reason: Joi.string().trim().max(200).optional().allow(''),
});

export const createTableSchema = Joi.object({
  tableNumber: tableLabelSchema.required(),
  seatCapacity: Joi.number().integer().min(1).max(20).required(),
  location: Joi.string().trim().max(100).optional().allow(''),
});

export const batchCreateTablesSchema = Joi.object({
  tables: Joi.array()
    .items(
      Joi.object({
        tableNumber: tableLabelSchema.required(),
        seatCapacity: Joi.number().integer().min(1).max(20).required(),
        location: Joi.string().trim().max(100).optional().allow(''),
      })
    )
    .min(1)
    .required(),
});

export const reserveTableSchema = Joi.object({
  reservedBy: Joi.string().trim().min(2).max(100).required(),
  reservationTime: Joi.date().iso().required(),
});
