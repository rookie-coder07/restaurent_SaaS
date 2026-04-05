export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  KITCHEN_STAFF: 'kitchen_staff',
};

const ROLE_ALIASES = {
  admin: ROLES.OWNER,
  owner: ROLES.OWNER,
  manager: ROLES.MANAGER,
  waiter: ROLES.STAFF,
  cashier: ROLES.STAFF,
  staff: ROLES.STAFF,
  kitchen: ROLES.KITCHEN_STAFF,
  kitchen_staff: ROLES.KITCHEN_STAFF,
};

export const VALID_ROLES = Object.values(ROLES);

export function normalizeRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[normalizedRole] || normalizedRole;
}

export const ROLE_PERMISSIONS = {
  owner: ['create_menu', 'manage_menu', 'manage_orders', 'manage_staff', 'view_staff', 'view_analytics', 'manage_restaurant', 'view_orders', 'update_order_status'],
  manager: ['manage_orders', 'manage_tables', 'view_staff', 'view_analytics', 'view_orders', 'update_order_status'],
  staff: ['view_orders', 'manage_orders'],
  kitchen_staff: ['view_orders', 'update_order_status'],
};

export const ORDER_STATUS = {
  AWAITING_WAITER_APPROVAL: 'awaiting_waiter_approval',
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
};

export const RESTAURANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
};

export default {
  ROLES,
  ROLE_PERMISSIONS,
  ORDER_STATUS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLANS,
  RESTAURANT_STATUS,
};
