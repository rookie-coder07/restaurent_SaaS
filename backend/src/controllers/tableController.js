import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import TableService from '../services/tableService.js';
import { logError, logFailedRequest, logCriticalAction, logSuccessfulOperation } from '../utils/structuredLogging.js';

export const createTable = asyncHandler(async (req, res) => {
  try {
    const table = await TableService.createTable(req.user.restaurantId, req.body);
    
    logCriticalAction('table_created', {
      message: 'New table created',
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      tableId: table?.id,
      details: { tableNumber: req.body.tableNumber },
    });

    return sendSuccess(res, 201, table, 'Table created successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to create table',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      statusCode: 500,
      action: 'create_table',
    });
    throw error;
  }
});

export const createMultipleTables = asyncHandler(async (req, res) => {
  const tables = await TableService.createMultipleTables(req.user.restaurantId, req.body.tables);
  return sendSuccess(res, 201, tables, 'Tables created successfully');
});

export const getTables = asyncHandler(async (req, res) => {
  const filters = {
    isActive: req.query.isActive === 'true' ? true : undefined,
    limit: parseInt(req.query.limit) || 50,
    skip: parseInt(req.query.skip) || 0,
  };

  const result = await TableService.getTables(req.user.restaurantId, filters);
  return sendSuccess(res, 200, result, 'Tables fetched successfully');
});

export const getTableByQRCode = asyncHandler(async (req, res) => {
  const { qrCodeData } = req.params;
  const table = await TableService.getTableByQRCode(req.user?.restaurantId, qrCodeData);
  return sendSuccess(res, 200, table, 'Table fetched successfully');
});

export const updateTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  
  try {
    if (!tableId) {
      logFailedRequest(new Error('Table ID missing'), {
        message: 'Update table validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.user.restaurantId,
        statusCode: 400,
        action: 'update_table_validation',
      });
      return sendError(res, 400, 'Table ID is required');
    }

    const table = await TableService.updateTable(req.user.restaurantId, tableId, req.body);
    
    logCriticalAction('table_updated', {
      message: 'Table updated',
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      tableId,
      details: req.body,
    });

    return sendSuccess(res, 200, table, 'Table updated successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to update table',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      tableId,
      statusCode: 500,
      action: 'update_table',
    });
    throw error;
  }
});

export const reserveTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const table = await TableService.reserveTable(req.user.restaurantId, tableId, req.body);
  return sendSuccess(res, 200, table, 'Table reserved successfully');
});

export const releaseTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const table = await TableService.releaseTable(req.user.restaurantId, tableId);

  return sendSuccess(res, 200, table, 'Table released successfully');
});

export const claimTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const table = await TableService.claimTable(req.user.restaurantId, tableId, req.user.userId);

  return sendSuccess(res, 200, table, 'Table claimed successfully');
});

export const deleteTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  
  try {
    if (!tableId) {
      logFailedRequest(new Error('Table ID missing'), {
        message: 'Delete table validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.user.restaurantId,
        statusCode: 400,
        action: 'delete_table_validation',
      });
      return sendError(res, 400, 'Table ID is required');
    }

    logger.info(`📨 DELETE /tables/${tableId} - Deleting table`);

    const result = await TableService.deleteTable(req.user.restaurantId, tableId);

    logCriticalAction('table_deleted', {
      message: 'Table deleted',
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      tableId,
      severity: 'critical',
    });

    logger.info(`✅ Table deleted: ${tableId}`);
    return sendSuccess(res, 200, result, 'Table deleted successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to delete table',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      tableId,
      statusCode: 500,
      action: 'delete_table',
    });
    throw error;
  }
});

export const generateQRUrls = asyncHandler(async (req, res) => {
  const { tableIds } = req.body;

  const qrUrls = await Promise.all(
    tableIds.map(tableId => TableService.generateQRUrl(req.user.restaurantId, tableId))
  );

  return sendSuccess(res, 200, qrUrls, 'QR URLs generated successfully');
});
