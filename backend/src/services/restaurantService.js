import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import AuthService from './authService.js';

export class RestaurantService {
  static transformRestaurant(restaurant) {
    if (!restaurant) return null;

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
      defaultGSTPercent: restaurant.default_gst_percent ?? 5,
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
      status: user.status || 'active',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
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
      const payload = {
        updated_at: new Date().toISOString(),
      };

      if (settings.enableGST !== undefined) payload.enable_gst = settings.enableGST;
      if (settings.defaultGSTPercent !== undefined) {
        payload.default_gst_percent = settings.defaultGSTPercent;
      }
      if (settings.currency !== undefined) payload.currency = settings.currency;

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .update(payload)
        .eq('id', restaurantId)
        .select()
        .single();

      if (error || !restaurant) throw error || new Error('Restaurant not found');

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
      const staffPayload = {
        restaurant_id: restaurantId,
        name: staffData.name,
        email: staffData.email.toLowerCase(),
        phone: staffData.phone,
        role: staffData.role,
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
        .in('role', ['staff', 'kitchen_staff']);

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
