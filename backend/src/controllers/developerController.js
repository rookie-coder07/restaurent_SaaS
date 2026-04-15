import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import DeveloperService from '../services/developerService.js';
import AuthReconciliationService from '../services/authReconciliationService.js';

export const getDashboard = asyncHandler(async (req, res) => {
  console.log('[DEVELOPER_API] getDashboard called', {
    userId: req.user?.id,
    role: req.user?.role,
  });
  return sendSuccess(res, 200, await DeveloperService.getDashboard(), 'Developer dashboard fetched successfully')
});
export const getControlCenterOverview = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.getControlCenterOverview(), 'Control center overview fetched successfully'));
export const getLiveMonitor = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.getLiveMonitor(), 'Live monitor fetched successfully'));
export const createDeveloperUser = asyncHandler(async (req, res) => sendSuccess(res, 201, await DeveloperService.createDeveloperUser(req.body, req.user), 'Developer user created successfully'));
export const createRestaurant = asyncHandler(async (req, res) => sendSuccess(res, 201, await DeveloperService.createRestaurant(req.body, req.user), 'Restaurant created successfully'));
export const getRestaurants = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.listRestaurants(req.query), 'Restaurants fetched successfully'));
export const updateRestaurantAccess = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.updateRestaurantAccess(req.params.restaurantId, req.body, req.user), 'Restaurant updated successfully'));
export const forceLogoutRestaurantUsers = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.forceLogoutRestaurantUsers(req.params.restaurantId, req.user), 'Restaurant users logged out successfully'));
export const getUsers = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.listUsers(req.query), 'Users fetched successfully'));
export const updateUserStatus = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.updateUserStatus(req.params.userId, req.body.status, req.user), 'User status updated successfully'));
export const updateUserRole = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.updateUserRole(req.params.userId, req.body.role, req.user), 'User role updated successfully'));
export const resetUserPassword = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.resetUserPassword(req.params.userId, req.body.newPassword, req.user), 'User password reset successfully'));
export const auditAuthMappings = asyncHandler(async (req, res) => sendSuccess(res, 200, await AuthReconciliationService.buildAudit(req.query.scope || 'all'), 'Auth mapping audit fetched successfully'));
export const reconcileAuthMappings = asyncHandler(async (req, res) => sendSuccess(res, 200, await AuthReconciliationService.reconcile(req.body, req.user), 'Auth mappings reconciled successfully'));
export const forceLogoutUser = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.forceLogoutUser(req.params.userId, req.user), 'User logged out successfully'));
export const getUserLoginHistory = asyncHandler(async (req, res) => sendSuccess(res, 200, { items: await DeveloperService.getUserLoginHistory(req.params.userId, Number(req.query.limit) || 20) }, 'User login history fetched successfully'));
export const getSystemSettings = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.getSystemSettings(), 'System settings fetched successfully'));
export const updateSystemSettings = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.updateSystemSettings(req.body, req.user), 'System settings updated successfully'));
export const updateMaintenance = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.updateMaintenance(req.body, req.user), 'Maintenance setting updated successfully'));
export const getFeatureFlags = asyncHandler(async (req, res) => sendSuccess(res, 200, { items: await DeveloperService.listFeatureFlags() }, 'Feature flags fetched successfully'));
export const updateFeatureFlag = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.updateFeatureFlag(req.body, req.user), 'Feature flag updated successfully'));
export const getAuditLogs = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.listAuditLogs(req.query), 'Audit logs fetched successfully'));
export const getSecurityOverview = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.getSecurityOverview(), 'Security overview fetched successfully'));
export const getErrorTracking = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.getErrorTracking({ limit: Number(req.query.limit) || 20 }), 'Error tracking fetched successfully'));
export const getSystemHealth = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.getSystemHealth(), 'System health fetched successfully'));
export const createBroadcast = asyncHandler(async (req, res) => sendSuccess(res, 201, await DeveloperService.createBroadcast(req.body, req.user), 'Broadcast created successfully'));
export const exportData = asyncHandler(async (req, res) => sendSuccess(res, 200, await DeveloperService.exportData(req.params.resource), 'Export prepared successfully'));
