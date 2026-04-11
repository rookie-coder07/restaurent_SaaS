export const ROLES = {
  ADMIN: 'admin',
  OWNER: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  DEVELOPER: 'developer',
};

const ROLE_ALIASES = {
  admin: ROLES.ADMIN,
  owner: ROLES.ADMIN,
  super_admin: ROLES.ADMIN,
  manager: ROLES.MANAGER,
  staff: ROLES.STAFF,
  waiter: ROLES.STAFF,
  cashier: ROLES.STAFF,
  developer: ROLES.DEVELOPER,
};

export const VALID_ROLES = Object.values(ROLES);

export function normalizeRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[normalizedRole] || normalizedRole;
}

export const ROLE_PERMISSIONS = {
  admin: ['create_menu', 'manage_menu', 'manage_orders', 'manage_staff', 'view_staff', 'view_analytics', 'manage_restaurant', 'view_orders', 'update_order_status'],
  developer: [
    'developer_console',
    'manage_restaurants',
    'manage_users',
    'manage_system',
    'manage_feature_flags',
    'manage_broadcasts',
    'view_audit_logs',
    'view_system_health',
    'manage_orders',
    'view_orders',
    'manage_tables',
    'manage_menu',
    'view_analytics',
    'update_order_status',
  ],
  owner: ['create_menu', 'manage_menu', 'manage_orders', 'manage_staff', 'view_staff', 'view_analytics', 'manage_restaurant', 'view_orders', 'update_order_status'],
  manager: ['manage_orders', 'manage_tables', 'manage_staff', 'view_staff', 'view_analytics', 'view_orders', 'update_order_status'],
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
