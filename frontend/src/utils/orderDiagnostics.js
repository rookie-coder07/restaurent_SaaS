/**
 * Comprehensive Order ID Diagnostics
 * Helps identify where Order ID is being lost in the QR ordering flow
 */

export const diagOrderResponse = (response, context = 'unknown') => {
  const diagnostic = {
    context,
    timestamp: new Date().toISOString(),
    response: {
      status: response?.status,
      statusCode: response?.statusCode,
      statusText: response?.statusText,
      headers: {
        contentType: response?.headers?.['content-type'],
      },
    },
    data: {
      fullData: response?.data,
      dataKeys: Object.keys(response?.data || {}),
      nestedDataKeys: Object.keys(response?.data?.data || {}),
      dataValue: response?.data?.data,
    },
    orderPaths: {
      'response.data.data.id': response?.data?.data?.id,
      'response.data.data.orderId': response?.data?.data?.orderId,
      'response.data.id': response?.data?.id,
      'response.data.orderId': response?.data?.orderId,
      'response.data.order.id': response?.data?.order?.id,
      'response.id': response?.id,
      'response.orderId': response?.orderId,
    },
    success: {
      statusSuccess: response?.data?.success,
      statusCode: response?.data?.statusCode,
      httpStatus: response?.status,
    },
  };

  console.group('🔍 ORDER RESPONSE DIAGNOSTIC');
  console.table(diagnostic);
  console.log('Full Response Object:', response);
  console.groupEnd();

  return diagnostic;
};

export const findOrderId = (response) => {
  // Try all possible paths where order ID might be
  const possiblePaths = [
    () => response?.data?.data?.id,
    () => response?.data?.data?.orderId,
    () => response?.data?.id,
    () => response?.data?.orderId,
    () => response?.data?.order?.id,
    () => response?.id,
    () => response?.orderId,
    // Flattened structure
    () => response?.order_id,
    () => response?.id_,
    // Nested alternatives
    () => response?.data?.order?.orderId,
    () => response?.result?.id,
    () => response?.result?.orderId,
  ];

  for (let i = 0; i < possiblePaths.length; i++) {
    try {
      const id = possiblePaths[i]();
      if (id && typeof id === 'string' && id.trim().length > 0) {
        console.log(`✅ Found Order ID at path #${i}:`, id);
        return id;
      }
    } catch (e) {
      // Continue to next path
    }
  }

  console.error('❌ Order ID not found in any possible path');
  return null;
};

export const validateOrderResponse = (response) => {
  const issues = [];

  // Check HTTP status
  if (!response?.status || response.status < 200 || response.status >= 300) {
    issues.push(`Invalid HTTP status: ${response?.status}`);
  }

  // Check success flag
  if (response?.data?.success === false) {
    issues.push(`API returned success=false: ${response?.data?.message}`);
  }

  // Check for data
  if (!response?.data?.data) {
    issues.push('Response missing data.data structure');
  }

  // Check for order ID
  const orderId = findOrderId(response);
  if (!orderId) {
    issues.push('No order ID found in response');
  }

  return {
    isValid: issues.length === 0,
    issues,
    orderId,
    diagnostic: {
      status: response?.status,
      success: response?.data?.success,
      dataStructure: {
        hasData: !!response?.data,
        hasNestedData: !!response?.data?.data,
        nestedDataKeys: Object.keys(response?.data?.data || {}),
      },
    },
  };
};

export const logOrderFlowDiagnostic = (stage, data) => {
  console.log(`[ORDER_FLOW] ${stage}:`, {
    timestamp: new Date().toISOString(),
    ...data,
  });
};
