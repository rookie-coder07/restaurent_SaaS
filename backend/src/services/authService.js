import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { normalizeRole, ROLES, VALID_ROLES } from '../constants/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key-min-32-characters';

export class AuthService {
  static RESET_REQUEST_ROLES = {
    MANAGER: 'manager',
    POS: 'pos',
  };

  static buildStaffSessionUser(user) {
    const normalizedRole = normalizeRole(user?.role);

    return {
      id: user.id,
      restaurantId: user.restaurant_id,
      name: user.name,
      email: user.email,
      phone: user.phone || user.phone_number || '',
      role: normalizedRole,
      assignedTables: Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [],
      status: user.status || 'active',
    };
  }

  // Generate JWT access token
  static generateAccessToken(userId, restaurantId, email, role) {
    const normalizedRole = normalizeRole(role);

    if (!VALID_ROLES.includes(normalizedRole)) {
      throw new Error('Cannot issue token for an unsupported role');
    }

    const payload = {
      userId,
      restaurantId,
      email,
      role: normalizedRole,
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY || '15m',
    });
  }

  // Generate refresh token
  static generateRefreshToken(userId, restaurantId, email, role) {
    const normalizedRole = normalizeRole(role);

    if (!VALID_ROLES.includes(normalizedRole)) {
      throw new Error('Cannot issue refresh token for an unsupported role');
    }

    const payload = {
      userId,
      restaurantId,
      email,
      role: normalizedRole,
      type: 'refresh',
    };

    return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    });
  }

  // Hash password using bcrypt
  static async hashPassword(password) {
    try {
      const salt = await bcryptjs.genSalt(10);
      return await bcryptjs.hash(password, salt);
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Password hashing failed');
    }
  }

  // Compare password with hash
  static async comparePassword(password, hash) {
    try {
      return await bcryptjs.compare(password, hash);
    } catch (error) {
      logger.error('Password comparison error:', error);
      throw new Error('Password comparison failed');
    }
  }

  static normalizeResetRequestRole(role) {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === ROLES.MANAGER) {
      return this.RESET_REQUEST_ROLES.MANAGER;
    }

    if (normalizedRole === ROLES.STAFF || String(role || '').trim().toLowerCase() === 'pos') {
      return this.RESET_REQUEST_ROLES.POS;
    }

    throw new Error('Password reset requests are available only for manager and POS accounts');
  }

  static getActualRoleForResetRequest(resetRole) {
    return this.normalizeResetRequestRole(resetRole) === this.RESET_REQUEST_ROLES.MANAGER
      ? ROLES.MANAGER
      : ROLES.STAFF;
  }

  static getResetScopeForActor(actorRole) {
    const normalizedRole = normalizeRole(actorRole);

    if (normalizedRole === ROLES.OWNER) {
      return [this.RESET_REQUEST_ROLES.MANAGER, this.RESET_REQUEST_ROLES.POS];
    }

    if (normalizedRole === ROLES.MANAGER) {
      return [this.RESET_REQUEST_ROLES.POS];
    }

    return [];
  }

  // Register new restaurant
  static async registerRestaurant(data) {
    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('email', data.email.toLowerCase())
        .single();
      
      if (existing) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await this.hashPassword(data.password);

      // Create restaurant
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert([{
          name: data.name,
          email: data.email.toLowerCase(),
          password_hash: passwordHash,
          phone: data.phone,
          city: data.city,
          address: data.address,
          gst_number: data.gstNumber,
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Restaurant registered: ${restaurant.id} - ${restaurant.name}`);

      const accessToken = this.generateAccessToken(
        restaurant.id,
        restaurant.id,
        restaurant.email,
        ROLES.OWNER
      );

      const restaurantPayload = {
        id: restaurant.id,
        name: restaurant.name,
        email: restaurant.email,
        city: restaurant.city,
        role: ROLES.OWNER,
      };

      return {
        restaurant: restaurantPayload,
        accessToken,
        refreshToken: this.generateRefreshToken(
          restaurant.id,
          restaurant.id,
          restaurant.email,
          ROLES.OWNER
        ),
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  // Restaurant login
  static async loginRestaurant(email, password) {
    try {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !restaurant) {
        throw new Error('Invalid email or password');
      }

      const isPasswordValid = await this.comparePassword(password, restaurant.password_hash);

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      logger.info(`✅ Restaurant logged in: ${restaurant.id}`);

      const accessToken = this.generateAccessToken(
        restaurant.id,
        restaurant.id,
        restaurant.email,
        ROLES.OWNER
      );

      const refreshToken = this.generateRefreshToken(
        restaurant.id,
        restaurant.id,
        restaurant.email,
        ROLES.OWNER
      );

      return {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          email: restaurant.email,
          city: restaurant.city,
          role: ROLES.OWNER,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  // Staff login
  static async loginStaff(email, password) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !user) {
        throw new Error('Invalid email or password');
      }

      const isPasswordValid = await this.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      if (user.status !== 'active') {
        throw new Error('User account is inactive');
      }

      const normalizedRole = normalizeRole(user.role);
      if (!VALID_ROLES.includes(normalizedRole)) {
        throw new Error('User account has an unsupported role');
      }

      const accessToken = this.generateAccessToken(
        user.id,
        user.restaurant_id,
        user.email,
        normalizedRole
      );

      const refreshToken = this.generateRefreshToken(
        user.id,
        user.restaurant_id,
        user.email,
        normalizedRole
      );

      logger.info(`✅ Staff login successful: ${user.id}`);

      return {
        user: this.buildStaffSessionUser(user),
        restaurant: {
          id: user.restaurant_id,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Staff login error:', error);
      throw error;
    }
  }

  // Refresh token
  static async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token');
      }

      const accessToken = this.generateAccessToken(
        decoded.userId,
        decoded.restaurantId,
        decoded.email || 'user@restaurant',
        normalizeRole(decoded.role) || ROLES.OWNER
      );

      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw new Error('Failed to refresh token');
    }
  }

  // Change password
  static async changePassword(userId, currentPassword, newPassword, isRestaurant = false) {
    try {
      let table = isRestaurant ? 'restaurants' : 'users';
      let column = isRestaurant ? 'id' : 'id';

      const { data: account } = await supabase
        .from(table)
        .select('*')
        .eq(column, userId)
        .single();

      if (!account) {
        throw new Error('User not found');
      }

      const isValid = await this.comparePassword(currentPassword, account.password_hash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      const newHash = await this.hashPassword(newPassword);
      const { error } = await supabase
        .from(table)
        .update({ password_hash: newHash })
        .eq(column, userId);

      if (error) throw error;

      logger.info(`Password changed for user: ${userId}`);

      return { message: 'Password changed successfully' };
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  static async requestPasswordReset({ email, requestedRole }) {
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const resetRole = this.normalizeResetRequestRole(requestedRole);
      const actualRole = this.getActualRoleForResetRequest(resetRole);

      const { data: users, error } = await supabase
        .from('users')
        .select('id, restaurant_id, name, email, role, status')
        .eq('email', normalizedEmail)
        .eq('role', actualRole)
        .limit(2);

      if (error) throw error;

      if (!Array.isArray(users) || users.length === 0) {
        throw new Error('No matching account found for this reset request');
      }

      if (users.length > 1) {
        throw new Error('More than one matching account was found. Please contact Admin directly.');
      }

      const user = users[0];

      const { data: existingRequest, error: existingRequestError } = await supabase
        .from('password_reset_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequestError) throw existingRequestError;

      if (existingRequest) {
        throw new Error('A password reset request is already pending for this account');
      }

      const { data: request, error: requestError } = await supabase
        .from('password_reset_requests')
        .insert([{
          restaurant_id: user.restaurant_id,
          user_id: user.id,
          role: resetRole,
          status: 'pending',
          requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('id, role, status, requested_at')
        .single();

      if (requestError) {
        if (requestError.code === '42P01' || requestError.code === 'PGRST205') {
          throw new Error(
            'Database schema is missing password_reset_requests. Run backend/src/config/migrations/2026-04-06-add-password-reset-requests.sql.'
          );
        }

        throw requestError;
      }

      logger.info(`Password reset request created for user: ${user.id}`);

      return {
        id: request.id,
        role: request.role,
        status: request.status,
        requestedAt: request.requested_at,
      };
    } catch (error) {
      logger.error('Request password reset error:', error);
      throw error;
    }
  }

  static async getPendingResetRequests(restaurantId, actorRole) {
    try {
      const allowedRequestRoles = this.getResetScopeForActor(actorRole);
      if (allowedRequestRoles.length === 0) {
        throw new Error('Only manager or admin can view reset requests');
      }

      const { data: requests, error } = await supabase
        .from('password_reset_requests')
        .select(`
          id,
          role,
          status,
          requested_at,
          handled_at,
          users:user_id (
            id,
            name,
            email,
            role,
            status
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .in('role', allowedRequestRoles)
        .order('requested_at', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          throw new Error(
            'Database schema is missing password_reset_requests. Run backend/src/config/migrations/2026-04-06-add-password-reset-requests.sql.'
          );
        }

        throw error;
      }

      return (requests || []).map((request) => ({
        id: request.id,
        role: request.role,
        status: request.status,
        requestedAt: request.requested_at,
        handledAt: request.handled_at,
        user: request.users
          ? {
              id: request.users.id,
              name: request.users.name,
              email: request.users.email,
              role: normalizeRole(request.users.role),
              status: request.users.status || 'active',
            }
          : null,
      }));
    } catch (error) {
      logger.error('Get pending reset requests error:', error);
      throw error;
    }
  }

  static async resetUserPasswordFromRequest({ restaurantId, actor, requestId, newPassword }) {
    try {
      const allowedRequestRoles = this.getResetScopeForActor(actor?.role);
      if (allowedRequestRoles.length === 0) {
        throw new Error('Only manager or admin can reset passwords from requests');
      }

      const { data: request, error: requestError } = await supabase
        .from('password_reset_requests')
        .select('*')
        .eq('id', requestId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (requestError || !request) {
        throw requestError || new Error('Reset request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('This reset request has already been handled');
      }

      if (!allowedRequestRoles.includes(request.role)) {
        throw new Error('You are not allowed to process this reset request');
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, restaurant_id, name, email, role')
        .eq('id', request.user_id)
        .eq('restaurant_id', restaurantId)
        .single();

      if (userError || !user) {
        throw userError || new Error('Requested user account not found');
      }

      const expectedRole = this.getActualRoleForResetRequest(request.role);
      if (normalizeRole(user.role) !== expectedRole) {
        throw new Error('Reset request role does not match the target account');
      }

      if (String(actor?.userId || '') === String(user.id)) {
        throw new Error('You cannot reset your own password through reset requests');
      }

      const handledAt = new Date().toISOString();
      const newHash = await this.hashPassword(newPassword);

      const { error: updateUserError } = await supabase
        .from('users')
        .update({
          password_hash: newHash,
          updated_at: handledAt,
        })
        .eq('id', user.id)
        .eq('restaurant_id', restaurantId);

      if (updateUserError) throw updateUserError;

      const { error: updateRequestError } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'approved',
          handled_by: actor.userId,
          handled_by_role: normalizeRole(actor.role),
          handled_at: handledAt,
          updated_at: handledAt,
        })
        .eq('id', request.id)
        .eq('restaurant_id', restaurantId);

      if (updateRequestError) throw updateRequestError;

      logger.info(`Password reset request approved: ${request.id}`);

      return {
        requestId: request.id,
        handledAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: normalizeRole(user.role),
        },
      };
    } catch (error) {
      logger.error('Reset user password from request error:', error);
      throw error;
    }
  }

  static async verifyCurrentPassword(userId, currentPassword, isRestaurant = false) {
    try {
      const table = isRestaurant ? 'restaurants' : 'users';

      const { data: account } = await supabase
        .from(table)
        .select('*')
        .eq('id', userId)
        .single();

      if (!account) {
        throw new Error('User not found');
      }

      const isValid = await this.comparePassword(currentPassword, account.password_hash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      return true;
    } catch (error) {
      logger.error('Verify current password error:', error);
      throw error;
    }
  }

  static async getCurrentUserProfile(sessionUser) {
    const normalizedRole = normalizeRole(sessionUser?.role);

    if (normalizedRole === ROLES.OWNER) {
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('id, name, email, phone, city, address, gst_number, timezone')
        .eq('id', sessionUser.userId)
        .single();

      if (error || !restaurant) {
        throw error || new Error('Restaurant account not found');
      }

      return {
        id: restaurant.id,
        restaurantId: restaurant.id,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone || '',
        city: restaurant.city || '',
        address: restaurant.address || '',
        gstNumber: restaurant.gst_number || '',
        timezone: restaurant.timezone || 'Asia/Kolkata',
        role: ROLES.OWNER,
      };
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', sessionUser.userId)
      .single();

    if (error || !user) {
      throw error || new Error('User account not found');
    }

    return this.buildStaffSessionUser(user);
  }
}

export default AuthService;

