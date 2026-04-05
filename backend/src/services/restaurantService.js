import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import AuthService from './authService.js';

export class RestaurantService {
  static transformRestaurant(restaurant) {
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
      assignedTables: Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [],
      status: user.status || 'active',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  static async validateAssignedTables(restaurantId, assignedTables = []) {
    const normalizedTableIds = Array.from(
      new Set((assignedTables || []).map((tableId) => String(tableId || '').trim()).filter(Boolean))
    );

    if (normalizedTableIds.length === 0) {
      return [];
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

    return normalizedTableIds;
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

      return this.transformRestaurant(restaurant);
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
      return this.transformRestaurant(restaurant);
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
      return this.transformRestaurant(restaurant);
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

      return this.transformRestaurant(restaurant);
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

      return this.transformRestaurant(restaurant);
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
      if (updateData.timezone !== undefined) payload.timezone = updateData.timezone;

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(payload)
        .eq('id', restaurantId)
        .select()
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

      return this.transformRestaurant(restaurant);
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

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(payload)
        .eq('id', restaurantId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST204') {
          const message = String(error.message || '');
          if (
            message.includes("'print_provider'") ||
            message.includes("'print_service_url'") ||
            message.includes("'receipt_width_mm'") ||
            message.includes("'auto_print_kot'") ||
            message.includes("'auto_print_bill'") ||
            message.includes("'bill_printer'") ||
            message.includes("'kot_printers'") ||
            message.includes("'default_service_charge'") ||
            message.includes("'default_cgst_percent'") ||
            message.includes("'default_sgst_percent'")
          ) {
            throw new Error(
              'Database schema is missing restaurant settings columns. Run the latest restaurant settings migrations.'
            );
          }
        }

        throw error;
      }

      if (!restaurant) throw new Error('Restaurant not found');

      return this.transformRestaurant(restaurant);
    } catch (error) {
      logger.error('❌ Update restaurant settings error:', error);
      throw error;
    }
  }

  static async createStaffUser(restaurantId, staffData) {
    try {
      const { data: existingUser, error: existingError } = await supabase
        .from('users')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('email', staffData.email.toLowerCase())
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingUser) {
        throw new Error('Staff email already exists for this restaurant');
      }

      const passwordHash = await AuthService.hashPassword(staffData.password);
      const assignedTables = staffData.role === 'staff'
        ? await this.validateAssignedTables(restaurantId, staffData.assignedTables)
        : [];
      const staffPayload = {
        restaurant_id: restaurantId,
        name: staffData.name,
        email: staffData.email.toLowerCase(),
        phone: staffData.phone,
        role: staffData.role,
        assigned_tables: assignedTables,
        password_hash: passwordHash,
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

      return this.transformStaffUser(user);
    } catch (error) {
      logger.error('❌ Create staff user error:', error);
      throw error;
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

      const allStaff = (users || []).map((user) => this.transformStaffUser(user));
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
      const payload = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.name !== undefined) payload.name = updateData.name;
      if (updateData.phone !== undefined) payload.phone = updateData.phone;
      if (updateData.role !== undefined) payload.role = updateData.role;
      if (updateData.email !== undefined) {
        const normalizedEmail = updateData.email.toLowerCase();
        if (normalizedEmail !== String(existingUser.email || '').toLowerCase()) {
          const { data: duplicateUser, error: duplicateError } = await supabase
            .from('users')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('email', normalizedEmail)
            .neq('id', staffId)
            .maybeSingle();

          if (duplicateError) {
            throw duplicateError;
          }

          if (duplicateUser) {
            throw new Error('Staff email already exists for this restaurant');
          }
        }

        payload.email = normalizedEmail;
      }

      if (updateData.password) {
        payload.password_hash = await AuthService.hashPassword(updateData.password);
      }

      if (updateData.assignedTables !== undefined || nextRole !== 'staff') {
        payload.assigned_tables = nextRole === 'staff'
          ? await this.validateAssignedTables(restaurantId, updateData.assignedTables ?? existingUser.assigned_tables)
          : [];
      }

      const { data: user, error } = await supabase
        .from('users')
        .update(payload)
        .eq('restaurant_id', restaurantId)
        .eq('id', staffId)
        .select()
        .single();

      if (error || !user) {
        if (error?.code === 'PGRST204' && String(error.message || '').includes("'assigned_tables'")) {
          throw new Error(
            "Database schema is missing users.assigned_tables. Run the migration 2026-04-05-add-user-assigned-tables.sql."
          );
        }

        throw error || new Error('Failed to update staff user');
      }

      return this.transformStaffUser(user);
    } catch (error) {
      logger.error('❌ Update staff user error:', error);
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

      return this.transformRestaurant(restaurant);
    } catch (error) {
      logger.error('❌ Update subscription error:', error);
      throw error;
    }
  }
}

export default RestaurantService;
