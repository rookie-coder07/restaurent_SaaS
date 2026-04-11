/**
 * Response Optimization Utilities
 * Reduces payload size by removing unnecessary fields
 */

export const optimizeOrderResponse = (order) => {
  if (!order) return null;
  if (Array.isArray(order)) {
    return (order || []).filter(o => o).map(o => optimizeOrderResponse(o));
  }

  return {
    id: order?.id || null,
    tableId: order?.table_id || null,
    status: order?.status || 'unknown',
    totalAmount: order?.total_amount || 0,
    paymentMethod: order?.payment_method || 'cash',
    createdAt: order?.created_at || null,
    updatedAt: order?.updated_at || null,
    items: (order?.order_items || []).map(item => ({
      id: item?.id || null,
      menuItemId: item?.menu_item_id || null,
      quantity: item?.quantity || 0,
      unitPrice: item?.unit_price || 0,
    })),
    tableNumber: order?.tableNumber || null,
  };
};

export const optimizeTableResponse = (table) => {
  if (!table) return null;
  if (Array.isArray(table)) {
    return (table || []).filter(t => t).map(t => optimizeTableResponse(t));
  }

  return {
    id: table?.id || null,
    tableNumber: table?.table_number || null,
    capacity: table?.capacity || 0,
    status: table?.status || 'available',
    location: table?.location || 'main',
  };
};

export const optimizeMenuItemResponse = (item) => {
  if (!item) return null;
  if (Array.isArray(item)) {
    return (item || []).filter(i => i).map(i => optimizeMenuItemResponse(i));
  }

  return {
    id: item?.id || null,
    name: item?.name || 'Unknown Item',
    price: item?.price || 0,
    description: item?.description || '',
    categoryId: item?.category_id || null,
    preparationTime: item?.preparation_time || 0,
    tags: item?.tags || [],
  };
};

export const optimizeCategoryResponse = (category) => {
  if (!category) return null;
  if (Array.isArray(category)) {
    return (category || []).filter(c => c).map(c => optimizeCategoryResponse(c));
  }

  return {
    id: category?.id || null,
    name: category?.name || 'Unknown Category',
    description: category?.description || '',
    displayOrder: category?.display_order || 0,
  };
};

export const optimizeAnalyticsResponse = (analytics) => {
  if (!analytics) return null;

  return {
    totalOrders: analytics?.totalOrders || 0,
    totalRevenue: analytics?.totalRevenue || 0,
    averageOrderValue: analytics?.averageOrderValue || 0,
    completedOrders: analytics?.completedOrders || 0,
    period: analytics?.period || 'unknown',
  };
};

/**
 * Strip response of unnecessary database fields
 */
export const stripDatabaseFields = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(stripDatabaseFields);
  if (typeof obj !== 'object') return obj;

  // Fields to always remove
  const fieldsToRemove = [
    'created_at',
    'updated_at',
    'deleted_at',
    'is_deleted',
    '__typename',
  ];

  const stripped = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!fieldsToRemove.includes(key)) {
      stripped[key] = Array.isArray(value)
        ? value.map(stripDatabaseFields)
        : typeof value === 'object'
          ? stripDatabaseFields(value)
          : value;
    }
  }

  return stripped;
};

export default {
  optimizeOrderResponse,
  optimizeTableResponse,
  optimizeMenuItemResponse,
  optimizeCategoryResponse,
  optimizeAnalyticsResponse,
  stripDatabaseFields,
};
