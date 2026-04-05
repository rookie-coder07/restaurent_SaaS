import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { normalizeRole, ROLES, VALID_ROLES } from '../constants/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key-min-32-characters';

export class AuthService {
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
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: normalizedRole,
          assignedTables: Array.isArray(user.assigned_tables) ? user.assigned_tables.filter(Boolean) : [],
        },
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
}

export default AuthService;

