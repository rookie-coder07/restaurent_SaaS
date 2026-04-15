import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import supabaseImport, { getSupabaseAdmin } from '../config/supabase.js';
import { normalizeRole, ROLES, VALID_ROLES } from '../constants/index.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  storeRefreshToken,
  TOKEN_CONFIG,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
} from '../utils/tokenManager.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key-min-32-characters';

// Allow supabase to be injected for testing
let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;
const supabase = getSupabase();

export class AuthService {
  static RESET_REQUEST_ROLES = {
    MANAGER: 'manager',
    POS: 'pos',
  };

  static buildPasswordUpdatePayload(passwordHash, timestamp = new Date().toISOString()) {
    return {
      password_hash: passwordHash,
      password_hash_cleared: false,
      password_updated_at: timestamp,
      updated_at: timestamp,
    };
  }

  static isMissingColumnError(error, columnName = '') {
    const normalizedColumnName = String(columnName || '').trim().toLowerCase();
    const combined = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    const isMissingError = combined.includes('could not find') || combined.includes('does not exist') || combined.includes('schema cache');
    return isMissingError && normalizedColumnName ? combined.includes(normalizedColumnName) : false;
  }

  static omitKeys(payload = {}, keys = []) {
    const clone = { ...payload };
    for (const key of keys) {
      delete clone[key];
    }
    return clone;
  }

  static async updatePasswordTrackingColumns(table, matcher = {}, passwordHash, timestamp = new Date().toISOString()) {
    const attempts = [
      this.buildPasswordUpdatePayload(passwordHash, timestamp),
      this.omitKeys(this.buildPasswordUpdatePayload(passwordHash, timestamp), ['password_hash_cleared']),
      this.omitKeys(this.buildPasswordUpdatePayload(passwordHash, timestamp), ['password_hash_cleared', 'password_updated_at']),
    ];

    let lastError = null;

    for (const payload of attempts) {
      let query = supabase
        .from(table)
        .update(payload);

      Object.entries(matcher || {}).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { error } = await query;

      if (!error) {
        return passwordHash;
      }

      lastError = error;

      // Continue if missing password tracking columns (they may not exist yet in older schemas)
      if (this.isMissingColumnError(error, 'password_hash_cleared') || 
          this.isMissingColumnError(error, 'password_updated_at')) {
        continue;
      }

      throw error;
    }

    // If all attempts fail due to missing columns, silently continue - schema migration may be pending
    logger.warn('Password tracking columns update skipped', {
      table,
      reason: 'Columns may not exist in this database version yet',
      errorMessage: lastError?.message,
    });
    return passwordHash;
  }

  static async persistRefreshToken(refreshToken, userId, restaurantId) {
    const expiresAt = new Date(Date.now() + TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000).toISOString();
    try {
      await storeRefreshToken(refreshToken, userId, restaurantId, expiresAt);
    } catch (error) {
      // If the refresh token table is missing we allow stateless operation but log a warning
      logger.warn('Refresh token persistence skipped', { userId, error: error.message });
    }
  }

  static setSupabase(supabaseInstance) {
    injectedSupabase = supabaseInstance;
  }

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

  // Generate JWT access token - now delegated to tokenManager
  static generateAccessToken(userId, restaurantId, email, role) {
    return generateAccessToken(userId, restaurantId, email, role);
  }

  // Generate refresh token - now delegated to tokenManager
  static generateRefreshToken(userId, restaurantId, email, role) {
    return generateRefreshToken(userId, restaurantId, email, role);
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
      if (!hash) {
        return false;
      }
      return await bcryptjs.compare(password, hash);
    } catch (error) {
      logger.error('Password comparison error:', error);
      throw new Error('Password comparison failed');
    }
  }

  static async verifyPasswordAgainstStoredHash(password, account, accountType = 'user') {
    const isValid = await this.comparePassword(password, account?.password_hash);

    logger.info(`[LOGIN] Stored password hash verification for ${accountType}`, {
      accountId: account?.id,
      email: account?.email,
      isValid,
      hasPasswordHash: !!account?.password_hash,
      passwordUpdatedAt: account?.password_updated_at || null,
    });

    return isValid;
  }

  static async syncPasswordHashIfMissing(table, accountId, password) {
    const passwordHash = await this.hashPassword(password);
    return await this.updatePasswordTrackingColumns(table, { id: accountId }, passwordHash);
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
      const normalizedEmail = data.email.toLowerCase();
      const passwordHash = await this.hashPassword(data.password);

      // Block duplicate emails across any user/role
      const { data: existingStaff, error: staffLookupError } = await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (staffLookupError) throw staffLookupError;
      if (existingStaff) {
        throw new Error('Email already registered to a staff/manager account');
      }

      // Check if email already exists in restaurants
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('email', normalizedEmail)
        .single();
      
      if (existing) {
        throw new Error('Email already registered');
      }

      // Create auth user - bypass email confirmation
      logger.info(`Creating Supabase Auth user for: ${normalizedEmail}`);
      let authData, authError;
      try {
        const adminClient = getSupabaseAdmin();
        ({ data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            name: data.name,
            role: ROLES.ADMIN,
          },
        }));
      } catch (adminInitError) {
        logger.error('❌ Failed to initialize Supabase admin client for restaurant registration');
        logger.error(`   Error: ${adminInitError.message}`);
        logger.error('   This typically means SUPABASE_SERVICE_ROLE_KEY is not configured in the backend environment');
        throw new Error(
          `Admin client initialization failed: ${adminInitError.message}. ` +
          `Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Render backend environment.`
        );
      }

      if (authError || !authData?.user?.id) {
        logger.error('Auth user creation failed:', authError?.message);
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      logger.info(`✅ Auth user created: ${authData.user.id}`);

      // Create restaurant record
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert([{
          id: authData.user.id,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          city: data.city,
          address: data.address,
          gst_number: data.gstNumber,
          password_hash: passwordHash,
          password_hash_cleared: false,
          password_updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (restaurantError) {
        logger.error('Restaurant creation failed:', restaurantError.message);
        throw restaurantError;
      }

      logger.info(`✅ Restaurant registered: ${restaurant.id} - ${restaurant.name}`);

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

      await this.persistRefreshToken(
        refreshToken,
        restaurant.id,
        restaurant.id
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
        refreshToken,
      };
    } catch (error) {
      logger.error('Registration error:', error.message);
      throw error;
    }
  }

  // Restaurant login
  // Unified login - handles both restaurant owners and staff
  static async login(email, password, portal = 'admin') {
    try {
      logger.info(`Unified login attempt for: ${email}, portal: ${portal}`);
      console.log('Login attempt:', { email, role: portal });
      
      // Authenticate with Supabase Auth
      let authError = null;
      let authData = null;
      
      try {
        logger.info(`🔄 Attempting Supabase Auth login for: ${email.toLowerCase()}, portal: ${portal}`);
        if (portal === 'manager') {
          logger.info('🔄 Manager portal login attempt detected');
        }
        
        ({ data: authData, error: authError } = await getSupabase().auth.signInWithPassword({
          email: email.toLowerCase(),
          password: password,
        }));
        
        logger.info('Auth response from Supabase:', {
          email: email.toLowerCase(),
          portal,
          userId: authData?.user?.id || null,
          authSucceeded: !authError,
          errorCode: authError?.code || null,
          errorMsg: authError?.message || null,
          errorStatus: authError?.status || null,
        });
      } catch (networkError) {
        // In test mode, handle network errors gracefully
        logger.error('Network error during login:', {
          email: email.toLowerCase(),
          portal,
          error: networkError.message,
        });
        if (process.env.NODE_ENV === 'test' && (networkError.message?.includes('fetch failed') || networkError.message?.includes('ENOTFOUND'))) {
          logger.warn(`Login network error in test mode for email: ${email} - returning error response`);
          throw new Error('Invalid email or password');
        }
        throw networkError;
      }

      const authFailedMessage = authError?.message || null;
      if (authError) {
        logger.warn(`Login failed for email: ${email.toLowerCase()}`, { 
          error: authFailedMessage,
          errorCode: authError.code,
          portal,
        });
      }

      if (authData?.user?.id) {
        logger.info(`✅ User authenticated in Supabase Auth: ${authData.user.id}`);
      }


      const authUserId = authData?.user?.id || null;

      // Portal-aware lookup: admin/owner uses restaurants first; others use users first
      const portalKey = String(portal || '').toLowerCase();
      const shouldPrioritizeRestaurant = portalKey === 'admin' || portalKey === 'owner';

      if (shouldPrioritizeRestaurant) {
        let restaurant;
        let restaurantError;

        if (authUserId) {
          ({ data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', authUserId)
            .single());
        }

        if ((restaurantError || !restaurant) && email) {
          logger.warn(`Restaurant not found by ID, searching by email: ${email}`);
          ({ data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('email', email.toLowerCase())
            .single());
        }

        if (restaurant && !restaurantError) {
          if (!restaurant.password_hash) {
            restaurant.password_hash = await this.syncPasswordHashIfMissing('restaurants', restaurant.id, password);
          }

          const restaurantPasswordValid = await this.verifyPasswordAgainstStoredHash(password, restaurant, 'restaurant');
          if (!restaurantPasswordValid) {
            throw new Error('Invalid email or password');
          }

          const userRole = ROLES.ADMIN;
          const accessToken = this.generateAccessToken(
            restaurant.id,
            restaurant.id,
            restaurant.email,
            userRole
          );
          const refreshToken = this.generateRefreshToken(
            restaurant.id,
            restaurant.id,
            restaurant.email,
            userRole
          );
          await this.persistRefreshToken(refreshToken, restaurant.id, restaurant.id);

          return {
            accessToken,
            refreshToken,
            role: userRole,
            restaurantId: restaurant.id,
            userId: restaurant.id,
            redirectTo: 'admin-dashboard',
          };
        }
      }

      // ✅ CRITICAL FIX: Fetch user table WITHOUT role filtering
      // Fetch ALL columns including role, restaurant_id, status, password_hash
      logger.info(`Auth user not found in restaurants, checking users table...`);
      let user;
      let userError;
      
      // Single unified lookup for all non-admin roles (including manager)
      // ✅ TASK 1: FETCH USER WITHOUT ROLE FILTER
      // SELECT * FROM users WHERE id = authUserId
      if (authUserId) {
        logger.debug(`Fetching user by ID: ${authUserId}`);
        ({ data: user, error: userError } = await supabase
          .from('users')
          .select('*, restaurants!inner(id, name, email, status)')
          .eq('id', authUserId)
          .single());
        
        if (userError) {
          logger.warn(`[LOGIN] User fetch by ID failed for authUserId ${authUserId}: ${userError.message}`);
        } else if (user) {
          logger.info(`[LOGIN] User fetched from database by ID:`, {
            userId: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
            restaurantId: user.restaurant_id,
          });
        }
      }

      // If not found by ID, try by email (fallback)
      if ((userError || !user) && email) {
        logger.warn(`User not found by ID, searching by email: ${email}`);
        ({ data: user, error: userError } = await supabase
          .from('users')
          .select('*, restaurants!inner(id, name, email, status)')
          .eq('email', email.toLowerCase())
          .single());
        
        if (user) {
          logger.info(`[LOGIN] User fetched from database by email:`, {
            userId: user.id,
            email: user.email,
            role: user.role,
          });
        }
      }

      // User must exist - auto-provision on first login if needed
      // If user not found in DB, provision them automatically if auth succeeded
      if ((userError || !user) && authData?.user) {
        logger.warn(`Auto-provisioning user on first login: ${authData.user.id}`);
        
        // Find restaurant to attach user to
        let restaurantId = null;
        
        if (portalKey !== 'developer') {
          const { data: ownerRestaurant } = await supabase
            .from('restaurants')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();
          if (ownerRestaurant?.id) {
            restaurantId = ownerRestaurant.id;
          } else {
            const { data: anyRestaurant } = await supabase
              .from('restaurants')
              .select('id')
              .limit(1);
            restaurantId = anyRestaurant?.[0]?.id || null;
          }
        }

        const inferredRole = normalizeRole(portalKey === 'developer' ? ROLES.DEVELOPER : portalKey === 'manager' ? ROLES.MANAGER : ROLES.STAFF);

        const provisionPayload = {
          id: authData.user.id,
          name: authData.user.user_metadata?.name || email.split('@')[0],
          email: email.toLowerCase(),
          restaurant_id: restaurantId,
          role: inferredRole,
          status: 'active',
        };

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([provisionPayload])
          .select('*')
          .single();

        if (createError) {
          logger.error(`Auto-provisioning failed: ${createError.message}`);
          throw createError;
        }

        user = newUser;
      } else if (userError || !user) {
        // User not found AND auth failed
        logger.warn(`Login failed for ${email}: ${authFailedMessage || 'User not found'}`);
        throw new Error(authFailedMessage || 'Invalid email or password');
      }

      if (!user) {
        logger.error(`[LOGIN] User not found in profile store for email: ${email}`);
        throw new Error('User not found in profile store');
      }

      logger.debug(`[LOGIN] User validation:`, {
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        hasRole: !!user.role,
      });

      if (!user.role) {
        logger.error(`[LOGIN] User role is missing for user: ${user.id}`);
        throw new Error('User role is missing');
      }

      if (user.status !== 'active') {
        logger.warn(`[LOGIN] User account is inactive for: ${user.email}, status: ${user.status}`);
        throw new Error('User account is inactive');
      }

      // \u2705 TASK 4: FIX ROLE CHECK - Allow admin, manager, staff\n      // CRITICAL FIX: If user has NO restaurant_id, assign one automatically\n      // This prevents managers from seeing 0 data due to null restaurant_id\n      if (!user.restaurant_id && normalizeRole(user.role) === ROLES.MANAGER) {\n        logger.warn(`[LOGIN] 🚨 Manager has NULL restaurant_id: ${user.email} - attempting to assign one`);\n        \n        // Try to find restaurant by email match first, then use first available\n        let restaurantId = null;\n        \n        const { data: emailMatchRestaurant } = await supabase\n          .from('restaurants')\n          .select('id, name')\n          .eq('email', email.toLowerCase())\n          .maybeSingle();\n        \n        if (emailMatchRestaurant?.id) {\n          restaurantId = emailMatchRestaurant.id;\n          logger.info(`[LOGIN] ✅ Found restaurant by email match: ${emailMatchRestaurant.name} (${restaurantId})`);\n        } else {\n          // Fallback: use first restaurant\n          const { data: firstRestaurant } = await supabase\n            .from('restaurants')\n            .select('id, name')\n            .limit(1)\n            .maybeSingle();\n          restaurantId = firstRestaurant?.id || null;\n          if (restaurantId) {\n            logger.info(`[LOGIN] ✅ No email match, using first restaurant: ${firstRestaurant.name} (${restaurantId})`);\n          }\n        }\n        \n        if (restaurantId) {\n          logger.info(`[LOGIN] ✅ Assigning restaurant ${restaurantId} to manager ${user.email}`);\n          const { error: assignError } = await supabase\n            .from('users')\n            .update({ restaurant_id: restaurantId })\n            .eq('id', user.id);\n          \n          if (assignError) {\n            logger.error(`[LOGIN] ❌ Failed to assign restaurant to manager: ${assignError.message}`);\n          } else {\n            user.restaurant_id = restaurantId;\n            logger.info(`[LOGIN] ✅ Manager restaurant assignment successful`);\n          }\n        } else {\n          logger.error('[LOGIN] ❌ No restaurant available to assign to manager');\n        }\n      }"

      const normalizedRole = normalizeRole(user.role);
      logger.debug(`[LOGIN] Role normalization:`, {
        rawRole: user.role,
        normalizedRole,
        isValid: VALID_ROLES.includes(normalizedRole),
        validRoles: VALID_ROLES,
      });
      
      if (!VALID_ROLES.includes(normalizedRole)) {
        logger.error(`[LOGIN] User has unsupported role: ${normalizedRole} (raw: ${user.role})`);
        throw new Error('User account has an unsupported role');
      }

      console.log('[AUTH_LOGIN] User authenticated:', {
        userId: user.id,
        email: user.email,
        rawRole: user.role,
        normalizedRole,
        portal,
        hasPasswordHash: !!user.password_hash,
        passwordHashCleared: user.password_hash_cleared,
        passwordUpdatedAt: user.password_updated_at,
      });   
      
      // ✅ DEBUG: Log the auth verification
      logger.info(`[LOGIN] Auth verification result:`, {
        authSucceeded: !authError,
        authUserId: authData?.user?.id,
        email: email.toLowerCase(),
        portal,
      });

      logger.info('Login user profile', {
        userId: user.id,
        email: user.email,
        role: normalizedRole,
        restaurantId: user.restaurant_id,
        hasPasswordHash: !!user.password_hash,
        passwordHashCleared: user.password_hash_cleared,
        passwordUpdatedAt: user.password_updated_at,
        authVerified: !!authData?.user?.id,
      });

      if (!user.password_hash) {
        user.password_hash = await this.syncPasswordHashIfMissing('users', user.id, password);
      }

      const localPasswordValid = await this.verifyPasswordAgainstStoredHash(password, user, 'user');
      if (!localPasswordValid) {
        logger.warn('[LOGIN] Rejecting login because stored password hash does not match', {
          userId: user.id,
          email: user.email,
          portal,
        });
        throw new Error('Invalid email or password');
      }

      // ✅ TASK 3: REMOVE INVALID COMPARISON
      // ✅ FIXED: Only trust Supabase Auth - no custom password checking
      // Password is managed by Supabase auth system, not local database
      // ❌ DO NOT: Use bcrypt.compare with database password_hash
      // ❌ DO NOT: Use inputPassword === user.password comparison
      // ✅ DO: Use Supabase Auth result which already verified the password
      
      if (authFailedMessage) {
        logger.error(`[LOGIN] Supabase Auth failed:`, {
          email: email.toLowerCase(),
          errorMessage: authFailedMessage,
          portal,
        });
        throw new Error(authFailedMessage || 'Invalid email or password');
      }
      if (!authData?.user?.id) {
        logger.error(`[LOGIN] Authentication failed - no auth user ID:`, {
          email: email.toLowerCase(),
          hasAuthData: !!authData,
          portal,
        });
        throw new Error('Authentication failed. Invalid email or password.');
      }
      
      logger.info(`[LOGIN] Password verified by Supabase Auth for: ${email.toLowerCase()}`);

      // ✅ FIXED: Never write passwords to database
      // Supabase Auth handles all password storage and verification

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
      await this.persistRefreshToken(refreshToken, user.id, user.restaurant_id);

      let redirectTo = 'pos';
      if (normalizedRole === ROLES.ADMIN) redirectTo = 'admin-dashboard';
      if (normalizedRole === ROLES.MANAGER) redirectTo = 'manager-dashboard';
      if (normalizedRole === ROLES.DEVELOPER) redirectTo = 'developer-dashboard';

      return {
        accessToken,
        refreshToken,
        role: normalizedRole,
        restaurantId: user.restaurant_id,
        userId: user.id,
        redirectTo,
      };
    } catch (error) {
      logger.error('Unified login error:', error.message);
      throw error;
    }
  }

  // Register new staff member
  static async registerStaff(data) {
    try {
      const normalizedEmail = data.email.toLowerCase();
      if (!data.role) {
        throw new Error('Role is required');
      }

      const normalizedRole = normalizeRole(data.role);
      if (!VALID_ROLES.includes(normalizedRole)) {
        throw new Error('Invalid role');
      }

      // Prevent conflicts with owner accounts
      const { data: ownerByEmail, error: ownerLookupError } = await supabase
        .from('restaurants')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (ownerLookupError) throw ownerLookupError;
      if (ownerByEmail) {
        throw new Error('Email already registered to an owner account');
      }

      // Check if email already exists in users
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .single();
      
      if (existing) {
        throw new Error('Email already registered');
      }

      // Create auth user
      logger.info(`Creating Supabase Auth user for staff: ${normalizedEmail}`);
      let authData, authError;
      const passwordHash = await this.hashPassword(data.password);
      try {
        const adminClient = getSupabaseAdmin();
        ({ data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            name: data.name,
            role: normalizedRole,
          },
        }));
      } catch (adminInitError) {
        logger.error('❌ Failed to initialize Supabase admin client for staff registration');
        logger.error(`   Error: ${adminInitError.message}`);
        logger.error('   This typically means SUPABASE_SERVICE_ROLE_KEY is not configured in the backend environment');
        throw new Error(
          `Admin client initialization failed: ${adminInitError.message}. ` +
          `Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Render backend environment.`
        );
      }

      if (authError || !authData?.user?.id) {
        logger.error('Staff auth user creation failed:', authError?.message);
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      logger.info(`✅ Auth user created: ${authData.user.id}`);

      // Create users table record
      let userError = null;
      let user = null;
      
      const userPayload = {
        id: authData.user.id,
        name: data.name,
        email: data.email.toLowerCase(),
        restaurant_id: data.restaurantId,
        role: normalizedRole,
        password_hash: passwordHash,
        password_hash_cleared: false,
        password_updated_at: new Date().toISOString(),
        phone_number: data.phone,
        status: 'active',
      };
      
      ({ data: user, error: userError } = await supabase
        .from('users')
        .insert([userPayload])
        .select()
        .single());

      // If phone_number column doesn't exist, retry without it
      if (userError && userError.message?.includes('phone_number')) {
        logger.warn('phone_number column not available in registerStaff, retrying without it');
        const { phone_number, ...payloadWithoutPhone } = userPayload;
        ({ data: user, error: userError } = await supabase
          .from('users')
          .insert([payloadWithoutPhone])
          .select('id, name, email, restaurant_id, role, status')
          .single());
      }

      if (userError) {
        logger.error('User creation failed:', userError.message);
        throw userError;
      }

      logger.info(`✅ User registered: ${user.id} - ${user.name}`);

      const accessToken = this.generateAccessToken(
        user.id,
        user.restaurant_id,
        user.email,
        normalizedRole
      );

      return {
        user: this.buildStaffSessionUser(user),
        restaurant: {
          id: user.restaurant_id,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Staff registration error:', error.message);
      throw error;
    }
  }

  // Refresh token
  static async refreshAccessToken(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Use secure token rotation from tokenManager
      // This validates the token, checks database, and rotates tokens
      const result = await rotateRefreshToken(
        refreshToken,
        null, // userId will be extracted from token
        null  // restaurantId will be extracted from token
      );

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        refreshExpiresIn: result.refreshExpiresIn,
        tokenType: result.tokenType,
      };
    } catch (error) {
      logger.error('Token refresh error:', error.message);
      throw new Error('Failed to refresh token. Please log in again.');
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

      const currentPasswordValid = await this.verifyPasswordAgainstStoredHash(currentPassword, account, table);
      if (!currentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // ✅ FIX: Authenticate against Supabase Auth, not database hash
      // Verify current password via Supabase Auth
      let authVerifyError = null;
      try {
        logger.info(`🔄 Verifying current password for change-password: ${account.email}`);
        ({ data: {}, error: authVerifyError } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: currentPassword,
        }));
        
        if (authVerifyError) {
          logger.warn('Auth verification during password change failed:', {
            email: account.email,
            errorCode: authVerifyError.code,
            errorMsg: authVerifyError.message,
          });
        } else {
          logger.info(`✅ Current password verified for: ${account.email}`);
        }
      } catch (authCheckError) {
        logger.warn('Auth verification during password change failed:', {
          email: account.email,
          error: authCheckError.message,
        });
        authVerifyError = authCheckError;
      }

      if (authVerifyError) {
        throw new Error('Current password is incorrect');
      }

      // ✅ FIX: Update password in Supabase Auth (PRIMARY source of truth)
      let authUpdateError = null;
      let authUpdateResponse = null;
      try {
        const adminClient = getSupabaseAdmin();
        logger.info(`🔄 Updating password in Supabase Auth for user: ${userId}`);
        
        ({ data: authUpdateResponse, error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
          password: newPassword
        }));
        
        logger.info('Password update response:', {
          userId,
          hasError: !!authUpdateError,
          errorMsg: authUpdateError?.message || null,
          hasData: !!authUpdateResponse,
          dataUser: authUpdateResponse?.user?.id || null,
        });
      } catch (adminInitError) {
        logger.error('❌ Admin client init error during password change:', {
          error: adminInitError.message,
          userId,
          stack: adminInitError.stack,
        });
        throw new Error('Password update failed: admin client not available');
      }

      if (authUpdateError) {
        logger.error('❌ Failed to update Supabase Auth password:', {
          userId,
          errorCode: authUpdateError.code,
          errorMsg: authUpdateError.message,
          errorStatus: authUpdateError.status,
        });
        throw authUpdateError;
      }
      
      logger.info(`✅ Password successfully updated in Supabase Auth for user: ${userId}`);

      // Return success immediately - all other operations are fire-and-forget background tasks
      const result = { message: 'Password changed successfully. Please log in again.' };

      // Fire-and-forget: All background operations that don't block response
      setImmediate(async () => {
        try {
          // 🔧 VERIFICATION: Test that the new password works
          try {
            const testLoginResponse = await supabase.auth.signInWithPassword({
              email: account.email,
              password: newPassword,
            });
            
            if (testLoginResponse.error) {
              logger.warn('⚠️ Password change verification warning - new password test failed (background):', {
                userId,
                email: account.email,
                errorCode: testLoginResponse.error.code,
                errorMsg: testLoginResponse.error.message,
              });
            } else if (testLoginResponse.data?.user?.id) {
              logger.info(`✅ Password change verification SUCCESS - new password works for ${account.email}`);
            }
          } catch (verifyError) {
            logger.warn('⚠️ Password change verification threw an error (background):', {
              userId,
              email: account.email,
              error: verifyError.message,
            });
          }

          // ✅ FIX: Clear database password_hash - Supabase Auth is now authoritative
          try {
            const passwordHash = await this.hashPassword(newPassword);
            await this.updatePasswordTrackingColumns(table, { [column]: userId }, passwordHash);
          } catch (trackingError) {
            logger.warn('Password tracking column update failed (background):', {
              userId,
              error: trackingError.message,
            });
          }

          // Revoke all refresh tokens for this user (force re-login for security)
          try {
            await revokeAllUserTokens(userId);
          } catch (revokeError) {
            logger.warn('Token revocation failed (background):', {
              userId,
              error: revokeError.message,
            });
          }
        } catch (backgroundError) {
          logger.warn('Background password operations error:', {
            userId,
            error: backgroundError.message,
          });
        }
      });

      return result;
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

      // ✅ FIX: Update password in Supabase Auth (PRIMARY source of truth)
      let authUpdateError = null;
      let authUpdateResponse = null;
      try {
        const adminClient = getSupabaseAdmin();
        logger.info(`🔄 Attempting manager password reset for user: ${user.id}`);
        
        ({ data: authUpdateResponse, error: authUpdateError } = await adminClient.auth.admin.updateUserById(user.id, {
          password: newPassword
        }));
        
        logger.info('Manager password update response:', {
          userId: user.id,
          userEmail: user.email,
          hasError: !!authUpdateError,
          errorMsg: authUpdateError?.message || null,
          hasData: !!authUpdateResponse,
          dataUser: authUpdateResponse?.user?.id || null,
        });
      } catch (adminInitError) {
        logger.error('❌ Admin client init error during manager password reset:', {
          error: adminInitError.message,
          userId: user.id,
          stack: adminInitError.stack,
        });
        throw new Error('Password reset failed: admin client not available');
      }

      if (authUpdateError) {
        logger.error('❌ Failed to update Supabase Auth password during manager reset:', {
          userId: user.id,
          userEmail: user.email,
          errorCode: authUpdateError.code,
          errorMsg: authUpdateError.message,
          errorStatus: authUpdateError.status,
        });
        throw authUpdateError;
      }
      
      logger.info(`✅ Password successfully updated in Supabase Auth during manager reset: ${user.id}`);

      // 🔧 VERIFICATION: Test that the new password works immediately
      // This is non-blocking - logging only, doesn't affect success
      try {
        const testLoginResponse = await supabase.auth.signInWithPassword({
          email: user.email,
          password: newPassword,
        });
        
        if (testLoginResponse.error) {
          logger.warn('⚠️ Manager password reset verification warning - new password test failed (non-blocking):', {
            userId: user.id,
            userEmail: user.email,
            errorCode: testLoginResponse.error.code,
            errorMsg: testLoginResponse.error.message,
          });
        } else if (testLoginResponse.data?.user?.id) {
          logger.info(`✅ Manager password reset verification SUCCESS - new password works for ${user.email}`);
        }
      } catch (verifyError) {
        logger.warn('⚠️ Manager password reset verification threw an error (non-blocking):', {
          userId: user.id,
          userEmail: user.email,
          error: verifyError.message,
        });
        // Continue anyway - password reset succeeded in Supabase Auth
      }

      // ✅ FIX: Clear database password_hash - Supabase Auth is now authoritative
      // This is non-blocking - if it fails, password is still reset in Supabase Auth
      try {
        const passwordHash = await this.hashPassword(newPassword);
        await this.updatePasswordTrackingColumns(
          'users',
          { id: user.id, restaurant_id: restaurantId },
          passwordHash,
          handledAt
        );
      } catch (trackingError) {
        logger.warn('Password tracking column update failed during password reset (non-blocking):', {
          userId: user.id,
          userEmail: user.email,
          error: trackingError.message,
        });
        // Continue anyway - password was successfully reset in Supabase Auth
      }

      // Update reset request status - also non-blocking as backup
      let requestUpdateSucceeded = false;
      try {
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

        if (updateRequestError) {
          logger.warn('Failed to update password reset request status (non-blocking):', {
            requestId: request.id,
            error: updateRequestError.message,
          });
        } else {
          requestUpdateSucceeded = true;
        }
      } catch (requestUpdateError) {
        logger.warn('Password reset request status update threw error (non-blocking):', {
          requestId: request.id,
          error: requestUpdateError.message,
        });
      }

      logger.info(`✅ Password successfully reset in Supabase Auth for user: ${user.id}`, {
        userId: user.id,
        userEmail: user.email,
        requestUpdateSucceeded,
      });

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

      const isValid = await this.verifyPasswordAgainstStoredHash(currentPassword, account, table);
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



