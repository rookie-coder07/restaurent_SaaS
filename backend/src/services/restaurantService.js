import logger from '../utils/logger.js';
import supabase, { getSupabaseAdmin } from '../config/supabase.js';
import AuthService from './authService.js';
import InvoiceService from './invoiceService.js';
import { revokeAllUserTokens } from '../utils/tokenManager.js';
import { validateRestaurantGSTContext, validateInvoiceCounterRestaurant } from '../middleware/multiTenantValidation.js';

export class RestaurantService {
  static transformRestaurant(restaurant, extras = {}) {
    if (!restaurant) return null;

    const normalizePrinter = (printer = {}, fallbackEnabled = false) => ({
      name: typeof printer?.name === 'string' ? printer.name : '',
      enabled: printer?.enabled ?? fallbackEnabled,
    });

    const normalizedKotPrinters = Array.isArray(restaurant.kot_printers)
      ? restaurant.kot_printers
        .map((printer) => normalizePrinter(printer, true))
        .filter((printer) => printer.name || printer.enabled)
      : [];

    const normalizedBillPrinter = normalizePrinter(restaurant.bill_printer, false);
    const printProvider = restaurant.print_provider || 'browser';
    const printServiceUrl = restaurant.print_service_url || '';
    const receiptWidthMm = [58, 80].includes(Number(restaurant.receipt_width_mm))
      ? Number(restaurant.receipt_width_mm)
      : 80;

    const defaultCgstPercent =
      restaurant.default_cgst_percent ??
      Number(restaurant.default_gst_percent ?? 5) / 2;
    const defaultSgstPercent =
      restaurant.default_sgst_percent ??
      Number(restaurant.default_gst_percent ?? 5) / 2;

    return {
      id: restaurant.id,
      name: restaurant.name || restaurant.business_name,
      email: restaurant.email,
      phone: restaurant.phone || '',
      city: restaurant.city || '',
      address: restaurant.address || '',
      gstNumber: restaurant.gst_number || '',
      gstAuthority: restaurant.gst_authority || '',
      logoUrl: restaurant.logo_url || '',
      cuisineType: restaurant.cuisine_type || '',
      status: restaurant.status || restaurant.subscription_status || 'active',
      subscriptionStatus: restaurant.subscription_status || 'active',
      timezone: restaurant.timezone || 'Asia/Kolkata',
      currency: restaurant.currency || 'INR',
      enableGST: restaurant.enable_gst ?? true,
      defaultGSTPercent: Number(restaurant.default_gst_percent ?? (defaultCgstPercent + defaultSgstPercent)),
      defaultCGSTPercent: Number(defaultCgstPercent),
      defaultSGSTPercent: Number(defaultSgstPercent),
      defaultServiceCharge: Number(restaurant.default_service_charge ?? 0),
      printProvider,
      printServiceUrl,
      receiptWidthMm,
      autoPrintKOT: restaurant.auto_print_kot ?? false,
      autoPrintBill: restaurant.auto_print_bill ?? false,
      billPrinter: normalizedBillPrinter,
      kotPrinters: normalizedKotPrinters,
      printing: {
        provider: printProvider,
        serviceUrl: printServiceUrl,
        receiptWidthMm,
        autoPrintKOT: restaurant.auto_print_kot ?? false,
        autoPrintBill: restaurant.auto_print_bill ?? false,
        billPrinter: normalizedBillPrinter,
        kotPrinters: normalizedKotPrinters,
      },
      createdAt: restaurant.created_at,
      updatedAt: restaurant.updated_at,
      role: 'owner',
      invoiceSettings: {
        prefix: extras.invoiceSettings?.prefix || InvoiceService.DEFAULT_PREFIX,
        nextNumber: Number(extras.invoiceSettings?.nextNumber || InvoiceService.DEFAULT_STARTING_NUMBER),
      },
    };
  }

  static transformStaffUser(user) {
    if (!user) return null;

    return {
      id: user.id,
      restaurantId: user.restaurant_id,
      name: user.name,
      email: user.email,
      phone: user.phone || user.phone_number || '',
      role: user.role,
      password: user.password || '',
      assignedTables: Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [],
      status: user.status || 'active',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  static async getBroadcastNotifications(restaurantId, { limit = 20 } = {}) {
    const { data, error } = await supabase
      .from('broadcast_notifications')
      .select('id, restaurant_id, title, message, audience, created_at')
      .or(`restaurant_id.is.null,restaurant_id.eq.${restaurantId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data || []).map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      title: row.title,
      message: row.message,
      audience: row.audience,
      createdAt: row.created_at,
    }));
  }

  static sanitizeStaffAssignmentRows(staffUsers = []) {
    const orderedUsers = [...(staffUsers || [])].sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
      return rightTime - leftTime;
    });

    const claimedTables = new Set();

    return orderedUsers.map((user) => {
      const currentAssignedTables = Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [];
      const nextAssignedTables = currentAssignedTables.filter((tableId) => {
        if (claimedTables.has(tableId)) {
          return false;
        }

        claimedTables.add(tableId);
        return true;
      });

      return {
        ...user,
        assigned_tables: nextAssignedTables,
      };
    });
  }

  static async validateAssignedTables(restaurantId, assignedTables = [], options = {}) {
    const normalizedTableIds = Array.from(
      new Set((assignedTables || []).map((tableId) => String(tableId || '').trim()).filter(Boolean))
    );

    if (normalizedTableIds.length === 0) {
      return {
        assignedTables: [],
        conflictingAssignments: [],
      };
    }

    const { data: tables, error } = await supabase
      .from('tables')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .in('id', normalizedTableIds);

    if (error) {
      throw error;
    }

    const validTableIds = new Set((tables || []).map((table) => table.id));
    if (validTableIds.size !== normalizedTableIds.length) {
      throw new Error('One or more selected tables do not belong to this restaurant');
    }

    const { data: staffUsers, error: staffError } = await supabase
      .from('users')
      .select('id, name, email, assigned_tables')
      .eq('restaurant_id', restaurantId)
      .eq('role', 'staff');

    if (staffError) {
      throw staffError;
    }

    const excludedStaffId = String(options.excludeStaffId || '').trim();
    const conflictingAssignments = [];

    this.sanitizeStaffAssignmentRows(staffUsers || []).forEach((user) => {
      if (!user?.id || (excludedStaffId && user.id === excludedStaffId)) {
        return;
      }

      const currentAssignedTables = Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [];
      currentAssignedTables.forEach((tableId) => {
        if (normalizedTableIds.includes(tableId)) {
          conflictingAssignments.push({
            tableId,
            ownerName: user.name || user.email || 'another waiter',
          });
        }
      });
    });

    if (conflictingAssignments.length > 0 && !options.allowTableReassign) {
      const firstConflict = conflictingAssignments[0];
      throw new Error(`Table is already assigned to ${firstConflict.ownerName}`);
    }

    return {
      assignedTables: normalizedTableIds,
      conflictingAssignments,
    };
  }

  // ============ RESTAURANT MANAGEMENT ============

  static async createRestaurant(restaurantData) {
    try {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert([{
          business_name: restaurantData.businessName,
          email: restaurantData.email,
          password_hash: restaurantData.passwordHash,
          phone: restaurantData.phone || '',
          address: restaurantData.address || '',
          city: restaurantData.city || '',
          cuisine_type: restaurantData.cuisineType || '',
          subscription_status: 'active',
          subscription_start: new Date(),
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Restaurant created: ${restaurant.id}`);
      return restaurant;
    } catch (error) {
      logger.error('❌ Create restaurant error:', error);
      throw error;
    }
  }

  static async getRestaurantById(restaurantId) {
    try {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurantId);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Get restaurant error:', error);
      throw error;
    }
  }

  static async updateRestaurant(restaurantId, updateData) {
    try {
      const updateFields = {
        updated_at: new Date(),
      };

      if (updateData.businessName) updateFields.business_name = updateData.businessName;
      if (updateData.phone) updateFields.phone = updateData.phone;
      if (updateData.address) updateFields.address = updateData.address;
      if (updateData.city) updateFields.city = updateData.city;
      if (updateData.cuisineType) updateFields.cuisine_type = updateData.cuisineType;

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(updateFields)
        .eq('id', restaurantId)
        .select()
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

      logger.info(`✅ Restaurant updated: ${restaurantId}`);
      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurantId);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Update restaurant error:', error);
      throw error;
    }
  }

  static async getRestaurantStats(restaurantId) {
    try {
      // Get orders count
      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId);

      if (ordersError) throw ordersError;

      // Get menu items count
      const { count: menuItemsCount, error: menuError } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active');

      if (menuError) throw menuError;

      // Get tables count
      const { count: tablesCount, error: tablesError } = await supabase
        .from('tables')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId);

      if (tablesError) throw tablesError;

      // Get staff count
      const { count: staffCount, error: staffError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('role', 'staff');

      if (staffError) throw staffError;

      return {
        totalOrders: ordersCount || 0,
        menuItemsCount: menuItemsCount || 0,
        tablesCount: tablesCount || 0,
        staffCount: staffCount || 0,
      };
    } catch (error) {
      logger.error('❌ Get restaurant stats error:', error);
      throw error;
    }
  }

  static async updateSubscriptionStatus(restaurantId, status) {
    try {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update({
          subscription_status: status,
          updated_at: new Date(),
        })
        .eq('id', restaurantId)
        .select()
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

      logger.info(`✅ Subscription status updated: ${restaurantId} → ${status}`);
      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurantId);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Update subscription error:', error);
      throw error;
    }
  }

  static async getRestaurantByEmail(email) {
    try {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('email', email)
        .single();

      if (error?.code === 'PGRST116') {
        return null; // No restaurant found
      }

      if (error) throw error;

      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurant.id);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Get restaurant by email error:', error);
      throw error;
    }
  }

  static async deleteRestaurant(restaurantId) {
    try {
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId);

      if (error) throw error;

      logger.info(`✅ Restaurant deleted: ${restaurantId}`);
      return { message: 'Restaurant deleted successfully' };
    } catch (error) {
      logger.error('❌ Delete restaurant error:', error);
      throw error;
    }
  }

  static async getAllRestaurants() {
    try {
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('id, business_name, email, subscription_status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (restaurants || []).map((restaurant) => this.transformRestaurant(restaurant));
    } catch (error) {
      logger.error('❌ Get all restaurants error:', error);
      throw error;
    }
  }

  static async getRestaurantProfile(restaurantId) {
    try {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

      // SECURITY: Validate GST context - ensures restaurant data matches requested restaurant
      // Prevents accidental or malicious access to another restaurant's GST number
      validateRestaurantGSTContext(restaurantId, restaurant);

      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurantId);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Get restaurant profile error:', error);
      throw error;
    }
  }

  static async updateRestaurantProfile(restaurantId, updateData) {
    try {
      const payload = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.name !== undefined) payload.name = updateData.name;
      if (updateData.phone !== undefined) payload.phone = updateData.phone;
      if (updateData.address !== undefined) payload.address = updateData.address;
      if (updateData.city !== undefined) payload.city = updateData.city;
      if (updateData.gstNumber !== undefined) payload.gst_number = updateData.gstNumber;
      if (updateData.gstAuthority !== undefined) payload.gst_authority = updateData.gstAuthority;
      if (updateData.timezone !== undefined) payload.timezone = updateData.timezone;

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(payload)
        .eq('id', restaurantId)
        .select()
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurantId);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Update restaurant profile error:', error);
      throw error;
    }
  }

  static async updateRestaurantSettings(restaurantId, settings) {
    try {
      const normalizePrinter = (printer = {}, fallbackEnabled = false) => ({
        name: typeof printer?.name === 'string' ? printer.name.trim() : '',
        enabled: printer?.enabled ?? fallbackEnabled,
      });

      const payload = {
        updated_at: new Date().toISOString(),
      };

      if (settings.enableGST !== undefined) payload.enable_gst = settings.enableGST;
      if (settings.defaultGSTPercent !== undefined) {
        payload.default_gst_percent = settings.defaultGSTPercent;
      }
      if (settings.defaultCGSTPercent !== undefined) {
        payload.default_cgst_percent = settings.defaultCGSTPercent;
      }
      if (settings.defaultSGSTPercent !== undefined) {
        payload.default_sgst_percent = settings.defaultSGSTPercent;
      }
      if (
        settings.defaultGSTPercent === undefined &&
        (settings.defaultCGSTPercent !== undefined || settings.defaultSGSTPercent !== undefined)
      ) {
        const nextCgst = Number(settings.defaultCGSTPercent ?? 0);
        const nextSgst = Number(settings.defaultSGSTPercent ?? 0);
        payload.default_gst_percent = nextCgst + nextSgst;
      }
      if (settings.defaultServiceCharge !== undefined) {
        payload.default_service_charge = settings.defaultServiceCharge;
      }
      if (settings.currency !== undefined) payload.currency = settings.currency;
      if (settings.printProvider !== undefined) payload.print_provider = settings.printProvider;
      if (settings.printServiceUrl !== undefined) payload.print_service_url = settings.printServiceUrl || null;
      if (settings.receiptWidthMm !== undefined) payload.receipt_width_mm = settings.receiptWidthMm;
      if (settings.autoPrintKOT !== undefined) payload.auto_print_kot = settings.autoPrintKOT;
      if (settings.autoPrintBill !== undefined) payload.auto_print_bill = settings.autoPrintBill;
      if (settings.billPrinter !== undefined) payload.bill_printer = normalizePrinter(settings.billPrinter, false);
      if (settings.kotPrinters !== undefined) {
        payload.kot_printers = (settings.kotPrinters || [])
          .map((printer) => normalizePrinter(printer, true))
          .filter((printer) => printer.name || printer.enabled);
      }

      const { error } = await supabase
        .from('restaurants')
        .update(payload)
        .eq('id', restaurantId);

      if (error) {
        // If error is about missing columns, try updating with basic settings only
        const errorMsg = String(error.message || '').toLowerCase();
        if (errorMsg.includes('could not find') && errorMsg.includes('column')) {
          logger.warn('⚠️  Some restaurant settings columns not found in schema, updating with basic settings only', {
            originalError: error.message,
          });
          
          // Try with minimal payload (just the basic settings that must exist)
          const basicPayload = {
            updated_at: new Date().toISOString(),
          };
          
          if (settings.enableGST !== undefined) basicPayload.enable_gst = settings.enableGST;
          if (settings.defaultGSTPercent !== undefined) basicPayload.default_gst_percent = settings.defaultGSTPercent;
          if (settings.defaultCGSTPercent !== undefined) basicPayload.default_cgst_percent = settings.defaultCGSTPercent;
          if (settings.defaultSGSTPercent !== undefined) basicPayload.default_sgst_percent = settings.defaultSGSTPercent;
          if (settings.currency !== undefined) basicPayload.currency = settings.currency;
          
          const { error: fallbackError } = await supabase
            .from('restaurants')
            .update(basicPayload)
            .eq('id', restaurantId);
          
          if (fallbackError) {
            const schemaError = new Error(
              'Database schema migration is needed. Please run the printer settings migration from PRINTER_SETUP_GUIDE.md'
            );
            schemaError.originalError = fallbackError;
            logger.error('❌ Basic settings update also failed:', { error: fallbackError });
            throw schemaError;
          }
        } else {
          throw error;
        }
      }

      // Fetch the updated restaurant separately to avoid RLS issues with select().single()
      const { data: restaurant, error: fetchError } = await supabase
        .from('restaurants')
        .select()
        .eq('id', restaurantId)
        .single();

      if (fetchError || !restaurant) {
        throw fetchError || new Error('Restaurant not found');
      }

      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurantId);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Update restaurant settings error:', error);
      throw error;
    }
  }

  static async createStaffUser(restaurantId, staffData) {
    try {
      const normalizedEmail = staffData.email.toLowerCase();

      // Cross-role uniqueness: block emails that belong to owners
      const { data: ownerByEmail, error: ownerLookupError } = await supabase
        .from('restaurants')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (ownerLookupError) throw ownerLookupError;
      if (ownerByEmail) {
        throw new Error('Email already registered to a restaurant owner');
      }

      const { data: existingUser, error: existingError } = await supabase
        .from('users')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingUser) {
        throw new Error('Staff email already exists for this restaurant');
      }

      const assignedTableValidation = staffData.role === 'staff'
        ? await this.validateAssignedTables(restaurantId, staffData.assignedTables, {
            allowTableReassign: Boolean(staffData.allowTableReassign),
          })
        : { assignedTables: [], conflictingAssignments: [] };
      const assignedTables = assignedTableValidation.assignedTables;

      // Create user in Supabase Auth (password managed by Supabase)
      const { data: authUser, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
        email: normalizedEmail,
        password: staffData.password,
        email_confirm: true,
        user_metadata: {
          name: staffData.name,
          role: staffData.role,
        },
      });

      if (authError) throw authError;
      if (!authUser.user?.id) throw new Error('Failed to create auth user');

      // Insert user record in database (NO password stored)
      const staffPayload = {
        id: authUser.user.id,
        restaurant_id: restaurantId,
        name: staffData.name,
        email: normalizedEmail,
        phone: staffData.phone,
        role: staffData.role,
        assigned_tables: assignedTables,
        status: 'active',
      };

      const { data: user, error } = await supabase
        .from('users')
        .insert([staffPayload])
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST204' && String(error.message || '').includes("'phone'")) {
          throw new Error(
            "Database schema is missing users.phone. Run: ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);"
          );
        }

        if (error.code === 'PGRST204' && String(error.message || '').includes("'assigned_tables'")) {
          throw new Error(
            "Database schema is missing users.assigned_tables. Run the migration 2026-04-05-add-user-assigned-tables.sql."
          );
        }

        throw error;
      }

      if (staffData.role === 'staff' && assignedTableValidation.conflictingAssignments.length > 0) {
        await this.releaseAssignedTablesFromOtherWaiters(
          restaurantId,
          user.id,
          assignedTableValidation.conflictingAssignments.map((entry) => entry.tableId)
        );
      }

      return this.transformStaffUser(user);
    } catch (error) {
      logger.error('❌ Create staff user error:', error);
      throw error;
    }
  }

  static async releaseAssignedTablesFromOtherWaiters(restaurantId, targetStaffId, tableIds = []) {
    const normalizedTableIds = Array.from(new Set((tableIds || []).filter(Boolean)));

    if (normalizedTableIds.length === 0) {
      return;
    }

    const { data: staffUsers, error } = await supabase
      .from('users')
      .select('id, assigned_tables')
      .eq('restaurant_id', restaurantId)
      .eq('role', 'staff');

    if (error) {
      throw error;
    }

    const updates = (staffUsers || [])
      .filter((user) => user.id && user.id !== targetStaffId)
      .map(async (user) => {
        const currentAssignedTables = Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [];
        const nextAssignedTables = currentAssignedTables.filter((tableId) => !normalizedTableIds.includes(tableId));

        if (nextAssignedTables.length === currentAssignedTables.length) {
          return;
        }

        const { error: updateError } = await supabase
          .from('users')
          .update({
            assigned_tables: nextAssignedTables,
            updated_at: new Date().toISOString(),
          })
          .eq('restaurant_id', restaurantId)
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }
      });

    await Promise.all(updates);
  }

  static async reconcileAssignedTables(restaurantId) {
    const { data: staffUsers, error } = await supabase
      .from('users')
      .select('id, assigned_tables, updated_at, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('role', 'staff');

    if (error) {
      throw error;
    }

    const sanitizedUsers = this.sanitizeStaffAssignmentRows(staffUsers || []);
    const updates = [];

    sanitizedUsers.forEach((user) => {
      const currentAssignedTables = Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [];
      const originalUser = (staffUsers || []).find((entry) => entry.id === user.id);
      const originalAssignedTables = Array.isArray(originalUser?.assigned_tables) ? originalUser.assigned_tables.filter(Boolean) : [];
      const nextAssignedTables = currentAssignedTables;

      if (nextAssignedTables.length !== originalAssignedTables.length) {
        updates.push(
          supabase
            .from('users')
            .update({
              assigned_tables: nextAssignedTables,
              updated_at: new Date().toISOString(),
            })
            .eq('restaurant_id', restaurantId)
            .eq('id', user.id)
        );
      }
    });

    if (updates.length > 0) {
      const results = await Promise.all(updates);
      const failedResult = results.find((result) => result.error);
      if (failedResult?.error) {
        throw failedResult.error;
      }
    }
  }

  static async getStaffUsers(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('role', ['manager', 'staff', 'kitchen_staff']);

      if (filters.role) {
        query = query.eq('role', filters.role);
      }

      if (filters.isActive !== undefined) {
        query = query.eq('status', filters.isActive ? 'active' : 'inactive');
      }

      const { data: users, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const transformedStaff = (users || [])
        .map(user => this.transformStaffUser(user));

      const allStaff = this.sanitizeStaffAssignmentRows(transformedStaff);

      const skip = filters.skip || 0;
      const limit = filters.limit || 50;

      return {
        staff: allStaff.slice(skip, skip + limit),
        total: allStaff.length,
        limit,
        skip,
      };
    } catch (error) {
      logger.error('❌ Get staff users error:', error);
      throw error;
    }
  }

  static async getStaffUserById(restaurantId, staffId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('id', staffId)
        .single();

      if (error || !user) {
        throw error || new Error('Staff user not found');
      }

      return this.transformStaffUser(user);
    } catch (error) {
      logger.error('Get staff user by id error:', error);
      throw error;
    }
  }

  static async updateStaffUser(restaurantId, staffId, updateData) {
    try {
      const { data: existingUser, error: existingError } = await supabase
        .from('users')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('id', staffId)
        .single();

      if (existingError || !existingUser) {
        throw existingError || new Error('Staff user not found');
      }

      const nextRole = updateData.role || existingUser.role;
      const payload = { updated_at: new Date().toISOString() };

      if (updateData.name !== undefined) payload.name = updateData.name;
      if (updateData.phone !== undefined) payload.phone = updateData.phone;
      if (updateData.role !== undefined) payload.role = updateData.role;
      
      let emailWasUpdatedInAuth = false;
      if (updateData.email !== undefined) {
        const normalizedEmail = updateData.email.toLowerCase();
        if (normalizedEmail !== String(existingUser.email || '').toLowerCase()) {
          const { data: ownerByEmail, error: ownerLookupError } = await supabase
            .from('restaurants')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();
          if (ownerLookupError) throw ownerLookupError;
          if (ownerByEmail) {
            throw new Error('Email already registered to a restaurant owner');
          }

          const { data: duplicateUser, error: duplicateError } = await supabase
            .from('users')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('email', normalizedEmail)
            .neq('id', staffId)
            .maybeSingle();
          if (duplicateError) throw duplicateError;
          if (duplicateUser) throw new Error('Staff email already exists for this restaurant');

          // Keep Supabase Auth in sync so login uses the new email
          const { error: authEmailError } = await getSupabaseAdmin().auth.admin.updateUserById(
            staffId,
            { email: normalizedEmail, email_confirm: true }
          );
          if (authEmailError) throw authEmailError;

          emailWasUpdatedInAuth = true;
        }
        payload.email = normalizedEmail;
      }

      if (updateData.password) {
        // Update password via Supabase Auth (not in database)
        const { error: authError } = await getSupabaseAdmin().auth.admin.updateUserById(
          staffId,
          { password: updateData.password }
        );
        if (authError) throw authError;
      }

      if (updateData.assignedTables !== undefined || nextRole !== 'staff') {
        if (nextRole === 'staff') {
          const validation = await this.validateAssignedTables(
            restaurantId,
            updateData.assignedTables ?? existingUser.assigned_tables,
            { excludeStaffId: staffId, allowTableReassign: Boolean(updateData.allowTableReassign) }
          );
          payload.assigned_tables = validation.assignedTables;
          
          if (validation.conflictingAssignments.length > 0) {
            const tableIds = validation.conflictingAssignments.map(e => String(e.tableId).trim());
            const { data: staffUsers } = await supabase
              .from('users')
              .select('id, assigned_tables')
              .eq('restaurant_id', restaurantId)
              .eq('role', 'staff')
              .neq('id', staffId);
            
            const updates = (staffUsers || [])
              .map(u => {
                const currentTables = (u.assigned_tables || []).filter(Boolean).map(t => String(t).trim());
                const nextTables = currentTables.filter(tid => !tableIds.some(conflictId => conflictId === tid));
                if (nextTables.length === currentTables.length) return null;
                logger.info(`  Removing ${currentTables.length - nextTables.length} conflicting tables from waiter ${u.id}`);
                return supabase.from('users').update({ assigned_tables: nextTables, updated_at: new Date().toISOString() })
                  .eq('restaurant_id', restaurantId).eq('id', u.id);
              })
              .filter(Boolean);
            
            if (updates.length > 0) {
              const results = await Promise.all(updates);
              const failedResult = results.find(r => r.error);
              if (failedResult?.error) {
                logger.error('❌ Failed to remove conflicting assignments:', failedResult.error);
                throw failedResult.error;
              }
            }
          }

          // ===== CRITICAL FIX: BEFORE reassigning, force hard-delete ALL locks =====
          const oldTables = new Set((existingUser.assigned_tables || []).filter(Boolean));
          const newTables = new Set((validation.assignedTables || []).filter(Boolean));
          
          const tablesToAdd = Array.from(newTables).filter(tid => !oldTables.has(tid));
          const tablesToRemove = Array.from(oldTables).filter(tid => !newTables.has(tid));

          // ===== STEP 1: HARD DELETE ALL LOCKS from tables being reassigned =====
          if (tablesToAdd.length > 0) {
            logger.info('TABLE REASSIGNMENT - HARD DELETE OLD LOCKS', {
              tables: tablesToAdd,
              new_waiter: staffId,
              old_count: Array.from(oldTables).length,
              new_count: Array.from(newTables).length,
            });

            // CRITICAL: Delete locked_by_qr flags first
            const { error: deleteQrLockError } = await supabase
              .from('tables')
              .update({
                locked_by_qr: false,
                updated_at: new Date().toISOString(),
              })
              .eq('restaurant_id', restaurantId)
              .in('id', tablesToAdd);

            if (deleteQrLockError) {
              logger.error('❌ FAILED to clear QR locks:', deleteQrLockError);
              throw deleteQrLockError;
            }

            // CRITICAL: Delete assigned_to for old owners
            const { error: deleteAssignmentError } = await supabase
              .from('tables')
              .update({
                assigned_to: null,
                updated_at: new Date().toISOString(),
              })
              .eq('restaurant_id', restaurantId)
              .in('id', tablesToAdd)
              .neq('assigned_to', staffId);

            if (deleteAssignmentError) {
              logger.error('❌ FAILED to clear old assignments:', deleteAssignmentError);
              throw deleteAssignmentError;
            }

            logger.info('✅ OLD LOCKS HARD DELETED', {
              tables: tablesToAdd,
              count: tablesToAdd.length,
            });
          }

          // ===== STEP 2: ASSIGN NEW WAITER with verification =====
          if (tablesToAdd.length > 0) {
            const { error: upsertError } = await supabase
              .from('tables')
              .update({
                assigned_to: staffId,
                locked_by_qr: false,
                updated_at: new Date().toISOString(),
              })
              .eq('restaurant_id', restaurantId)
              .in('id', tablesToAdd);

            if (upsertError) {
              logger.error('❌ FAILED to assign tables:', upsertError);
              throw upsertError;
            }

            logger.info('✅ NEW TABLES ASSIGNED', {
              waiter: staffId,
              table_count: tablesToAdd.length,
            });

            // ===== STEP 3: VERIFY NO STALE LOCKS REMAIN =====
            const { data: verifyTables, error: verifyError } = await supabase
              .from('tables')
              .select('id, assigned_to, locked_by_qr')
              .eq('restaurant_id', restaurantId)
              .in('id', tablesToAdd);

            if (!verifyError && verifyTables) {
              const staffId_string = String(staffId).trim();
              const staleLocks = verifyTables.filter(
                t => t.locked_by_qr || (String(t.assigned_to || '').trim() !== staffId_string)
              );

              if (staleLocks.length > 0) {
                logger.error('❌ STALE LOCKS FOUND AFTER ASSIGNMENT', {
                  stale_locks: staleLocks.map(t => ({
                    table_id: t.id,
                    locked_by_qr: t.locked_by_qr,
                    assigned_to: t.assigned_to,
                  })),
                });

                // EMERGENCY: Force clear all remaining stale locks
                const staleTableIds = staleLocks.map(t => t.id);
                const { error: emergencyClearError } = await supabase
                  .from('tables')
                  .update({
                    locked_by_qr: false,
                    assigned_to: staffId,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('restaurant_id', restaurantId)
                  .in('id', staleTableIds);

                if (emergencyClearError) {
                  logger.error('❌ EMERGENCY CLEAR FAILED:', emergencyClearError);
                  throw emergencyClearError;
                }

                logger.warn('⚠️ EMERGENCY CLEAR PERFORMED ON STALE LOCKS', {
                  table_count: staleTableIds.length,
                  tables: staleTableIds,
                });
              } else {
                logger.info('✅ VERIFICATION PASSED - NO STALE LOCKS');
              }
            }
          }

          // ===== STEP 4: Clean up removed tables =====
          if (tablesToRemove.length > 0) {
            const { error: removeError } = await supabase
              .from('tables')
              .update({
                locked_by_qr: false,
                assigned_to: null,
                updated_at: new Date().toISOString(),
              })
              .eq('restaurant_id', restaurantId)
              .in('id', tablesToRemove)
              .eq('assigned_to', staffId);

            if (removeError) {
              logger.error('❌ FAILED to clear removed tables:', removeError);
              throw removeError;
            }

            logger.info('✅ REMOVED TABLES CLEANED', {
              table_count: tablesToRemove.length,
            });
          }
        } else {
          // ✅ FIX: When role changes away from staff, clear all QR locks on their tables
          const oldTables = (existingUser.assigned_tables || []).filter(Boolean);
          if (oldTables.length > 0) {
            const { error: clearAllLocksError } = await supabase
              .from('tables')
              .update({
                locked_by_qr: false,
                assigned_to: null,
                updated_at: new Date().toISOString(),
              })
              .eq('restaurant_id', restaurantId)
              .in('id', oldTables)
              .eq('assigned_to', staffId);
            
            if (clearAllLocksError) {
              logger.warn('⚠️ Failed to clear QR locks when changing role:', clearAllLocksError);
            }
          }
          payload.assigned_tables = [];
        }
      }

      const { data: user, error } = await supabase
        .from('users')
        .update(payload)
        .eq('restaurant_id', restaurantId)
        .eq('id', staffId)
        .select()
        .single();

      if (error || !user) {
        if (emailWasUpdatedInAuth) {
          await getSupabaseAdmin().auth.admin.updateUserById(staffId, {
            email: existingUser.email,
            email_confirm: true,
          });
        }

        if (error?.code === 'PGRST204' && String(error.message || '').includes("'assigned_tables'")) {
          throw new Error("Database schema is missing users.assigned_tables. Run the migration 2026-04-05-add-user-assigned-tables.sql.");
        }
        throw error || new Error('Failed to update staff user');
      }

      return this.transformStaffUser(user);
    } catch (error) {
      logger.error('❌ Update staff user error:', error);
      throw error;
    }
  }

  static async resetStaffPassword(restaurantId, staffId, newPassword) {
    try {
      const { data: existingUser, error: existingError } = await supabase
        .from('users')
        .select('id, email')
        .eq('restaurant_id', restaurantId)
        .eq('id', staffId)
        .single();

      if (existingError || !existingUser) {
        throw existingError || new Error('Staff user not found');
      }

      // Update password via Supabase Auth (not in database)
      const { error: authError } = await getSupabaseAdmin().auth.admin.updateUserById(
        staffId,
        { password: newPassword }
      );

      if (authError) throw authError;

      // 🔧 FIXED: Clear password_hash from database - Supabase Auth is now source of truth
      const handledAt = new Date().toISOString();
      const { data: user, error } = await supabase
        .from('users')
        .update({
          password_hash: null, // Clear old password hash
          password_hash_cleared: true,
          password_updated_at: handledAt,  // Track password update time
          updated_at: handledAt,
        })
        .eq('restaurant_id', restaurantId)
        .eq('id', staffId)
        .select()
        .single();

      if (error || !user) {
        throw error || new Error('Failed to reset staff password');
      }

      // 🔧 FIXED: Revoke all refresh tokens for this user to invalidate existing sessions
      // This forces users to login again with the new password
      try {
        await revokeAllUserTokens(staffId);
        logger.info(`✅ Tokens revoked for staff user ${staffId} after password reset`);
      } catch (tokenError) {
        logger.warn(`⚠️ Could not revoke tokens for staff user ${staffId}: ${tokenError.message}`);
        // Don't fail the whole operation if token revocation fails
      }

      logger.info(`✅ Password reset for staff user ${staffId} - old password invalidated, sessions revoked`);
      return this.transformStaffUser(user);
    } catch (error) {
      logger.error('❌ Reset staff password error:', error);
      throw error;
    }
  }

  static async deactivateStaffUser(restaurantId, staffId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('id', staffId)
        .select()
        .single();

      if (error || !user) throw error || new Error('Staff user not found');

      return this.transformStaffUser(user);
    } catch (error) {
      logger.error('❌ Delete staff user error:', error);
      throw error;
    }
  }

  static async updateSubscription(restaurantId, updateData) {
    try {
      const payload = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.status !== undefined) payload.subscription_status = updateData.status;
      if (updateData.plan !== undefined) payload.subscription_plan = updateData.plan;
      if (updateData.renewalDate !== undefined) payload.subscription_renewal = updateData.renewalDate;

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(payload)
        .eq('id', restaurantId)
        .select()
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

      const invoiceSettings = await InvoiceService.getInvoiceCounter(restaurantId);
      return this.transformRestaurant(restaurant, { invoiceSettings });
    } catch (error) {
      logger.error('❌ Update subscription error:', error);
      throw error;
    }
  }
  static async updateInvoiceSettings(restaurantId, settings) {
    try {
      const invoiceSettings = await InvoiceService.updateInvoiceSettings(restaurantId, settings);
      return {
        prefix: invoiceSettings.prefix,
        nextNumber: invoiceSettings.nextNumber,
      };
    } catch (error) {
      logger.error('Invoice settings update error:', error);
      throw error;
    }
  }
}

export default RestaurantService;
