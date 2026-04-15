import crypto from 'crypto';
import supabaseImport, { getSupabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import AuthService from './authService.js';

let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;

export class AuthReconciliationService {
  static PAGE_SIZE = 200;

  static setSupabase(instance) {
    injectedSupabase = instance;
  }

  static normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  static async getAllAuthUsers() {
    const allUsers = [];

    for (let page = 1; page <= 50; page += 1) {
      const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ page, perPage: this.PAGE_SIZE });
      if (error) {
        throw error;
      }

      const users = data?.users || [];
      allUsers.push(...users);

      if (users.length < this.PAGE_SIZE) {
        break;
      }
    }

    return allUsers;
  }

  static async fetchEntityRows(table) {
    const baseSelect = table === 'users'
      ? 'id, supabase_user_id, restaurant_id, name, email, role, status, created_at, updated_at'
      : 'id, supabase_user_id, name, email, status, created_at, updated_at';
    const fallbackSelect = table === 'users'
      ? 'id, restaurant_id, name, email, role, status, created_at, updated_at'
      : 'id, name, email, status, created_at, updated_at';

    let mappingColumnAvailable = true;
    let query = getSupabase()
      .from(table)
      .select(baseSelect)
      .order('created_at', { ascending: true });

    let result = await query;
    if (result.error && AuthService.isMissingColumnError(result.error, 'supabase_user_id')) {
      mappingColumnAvailable = false;
      result = await getSupabase()
        .from(table)
        .select(fallbackSelect)
        .order('created_at', { ascending: true });
    }

    if (result.error) {
      throw result.error;
    }

    return {
      rows: result.data || [],
      mappingColumnAvailable,
    };
  }

  static buildDuplicateIndex(rows, entityLabel) {
    const groups = new Map();

    for (const row of rows || []) {
      const email = this.normalizeEmail(row?.email);
      if (!email) {
        continue;
      }

      const existing = groups.get(email) || [];
      existing.push({
        id: row.id,
        entity: entityLabel,
        name: row.name || '',
      });
      groups.set(email, existing);
    }

    return Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([email, items]) => ({
        email,
        count: items.length,
        records: items,
      }));
  }

  static buildCrossEntityDuplicates(userRows, restaurantRows) {
    const usersByEmail = new Map((userRows || [])
      .map((row) => [this.normalizeEmail(row?.email), row])
      .filter(([email]) => Boolean(email)));

    const groups = [];

    for (const restaurant of restaurantRows || []) {
      const email = this.normalizeEmail(restaurant?.email);
      if (!email || !usersByEmail.has(email)) {
        continue;
      }

      groups.push({
        email,
        userId: usersByEmail.get(email).id,
        restaurantId: restaurant.id,
      });
    }

    return groups;
  }

  static buildAuthIndexes(authUsers) {
    const authById = new Map();
    const authByEmail = new Map();

    for (const authUser of authUsers || []) {
      const authId = String(authUser?.id || '').trim();
      const email = this.normalizeEmail(authUser?.email);

      if (authId) {
        authById.set(authId, authUser);
      }

      if (email) {
        authByEmail.set(email, authUser);
      }
    }

    return { authById, authByEmail };
  }

  static classifyRecord(row, table, authIndexes, duplicateEmailSet, crossEntityEmailSet) {
    const email = this.normalizeEmail(row?.email);
    const mappedSupabaseUserId = String(row?.supabase_user_id || '').trim();
    const authByMappedId = mappedSupabaseUserId ? authIndexes.authById.get(mappedSupabaseUserId) || null : null;
    const authByDatabaseId = authIndexes.authById.get(String(row?.id || '').trim()) || null;
    const authByEmail = email ? authIndexes.authByEmail.get(email) || null : null;

    let status = 'missing_auth_user';

    if (!email) {
      status = 'missing_email';
    } else if (duplicateEmailSet.has(email)) {
      status = 'duplicate_email';
    } else if (crossEntityEmailSet.has(email)) {
      status = 'cross_entity_email_conflict';
    } else if (mappedSupabaseUserId && authByMappedId && this.normalizeEmail(authByMappedId.email) === email) {
      status = 'linked';
    } else if (mappedSupabaseUserId && authByMappedId && this.normalizeEmail(authByMappedId.email) !== email) {
      status = 'mapped_email_mismatch';
    } else if (mappedSupabaseUserId && !authByMappedId && authByEmail) {
      status = 'stale_mapping_email_exists';
    } else if (mappedSupabaseUserId && !authByMappedId) {
      status = 'stale_mapping_missing_auth';
    } else if (authByEmail && authByEmail.id === row.id) {
      status = 'db_id_matches_auth';
    } else if (authByEmail) {
      status = 'email_match_id_mismatch';
    } else if (authByDatabaseId) {
      status = 'db_id_email_mismatch';
    }

    return {
      id: row.id,
      table,
      email,
      name: row.name || '',
      role: row.role || (table === 'restaurants' ? 'owner' : ''),
      restaurantId: row.restaurant_id || null,
      status: row.status || 'active',
      mappedSupabaseUserId: mappedSupabaseUserId || null,
      authUserId: authByEmail?.id || authByMappedId?.id || authByDatabaseId?.id || null,
      authEmail: this.normalizeEmail(authByEmail?.email || authByMappedId?.email || authByDatabaseId?.email || ''),
      reconciliationStatus: status,
      canAutoLink: ['db_id_matches_auth', 'email_match_id_mismatch', 'stale_mapping_email_exists'].includes(status),
      canAutoCreate: ['missing_auth_user', 'stale_mapping_missing_auth'].includes(status),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  static summarizeRecords(records) {
    return records.reduce((summary, record) => {
      summary.total += 1;
      summary.byStatus[record.reconciliationStatus] = (summary.byStatus[record.reconciliationStatus] || 0) + 1;
      return summary;
    }, { total: 0, byStatus: {} });
  }

  static async buildAudit(scope = 'all') {
    const normalizedScope = ['users', 'restaurants'].includes(scope) ? scope : 'all';
    const [userData, restaurantData, authUsers] = await Promise.all([
      normalizedScope === 'restaurants' ? Promise.resolve({ rows: [], mappingColumnAvailable: true }) : this.fetchEntityRows('users'),
      normalizedScope === 'users' ? Promise.resolve({ rows: [], mappingColumnAvailable: true }) : this.fetchEntityRows('restaurants'),
      this.getAllAuthUsers(),
    ]);

    const authIndexes = this.buildAuthIndexes(authUsers);
    const userDuplicates = this.buildDuplicateIndex(userData.rows, 'user');
    const restaurantDuplicates = this.buildDuplicateIndex(restaurantData.rows, 'restaurant');
    const crossDuplicates = this.buildCrossEntityDuplicates(userData.rows, restaurantData.rows);
    const userDuplicateEmailSet = new Set(userDuplicates.map((entry) => entry.email));
    const restaurantDuplicateEmailSet = new Set(restaurantDuplicates.map((entry) => entry.email));
    const crossEntityEmailSet = new Set(crossDuplicates.map((entry) => entry.email));

    const userRecords = userData.rows.map((row) => this.classifyRecord(row, 'users', authIndexes, userDuplicateEmailSet, crossEntityEmailSet));
    const restaurantRecords = restaurantData.rows.map((row) => this.classifyRecord(row, 'restaurants', authIndexes, restaurantDuplicateEmailSet, crossEntityEmailSet));

    return {
      scope: normalizedScope,
      generatedAt: new Date().toISOString(),
      authUserCount: authUsers.length,
      mappingColumnAvailability: {
        users: userData.mappingColumnAvailable,
        restaurants: restaurantData.mappingColumnAvailable,
      },
      users: {
        records: userRecords,
        duplicates: userDuplicates,
        summary: this.summarizeRecords(userRecords),
      },
      restaurants: {
        records: restaurantRecords,
        duplicates: restaurantDuplicates,
        summary: this.summarizeRecords(restaurantRecords),
      },
      crossEntityDuplicates: crossDuplicates,
    };
  }

  static generateTemporaryPassword() {
    return `Tmp!${crypto.randomBytes(12).toString('base64url')}9a`;
  }

  static async createMissingAuthUser(record) {
    const temporaryPassword = this.generateTemporaryPassword();
    const adminClient = getSupabaseAdmin();
    const role = record.table === 'restaurants' ? 'admin' : String(record.role || 'staff').trim().toLowerCase();
    const metadata = {
      name: record.name || record.email.split('@')[0] || 'User',
      role,
      source_table: record.table,
      source_id: record.id,
    };

    const { data, error } = await adminClient.auth.admin.createUser({
      email: record.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error || !data?.user?.id) {
      throw error || new Error(`Failed to create auth user for ${record.email}`);
    }

    return {
      authUserId: data.user.id,
      temporaryPassword,
    };
  }

  static ensureMappingColumnsAvailable(report, scope = 'all') {
    const requiredTables = scope === 'users'
      ? ['users']
      : scope === 'restaurants'
        ? ['restaurants']
        : ['users', 'restaurants'];

    const missingTables = requiredTables.filter((table) => report.mappingColumnAvailability?.[table] === false);
    if (missingTables.length > 0) {
      throw new Error(
        `Database schema is missing ${missingTables.map((table) => `${table}.supabase_user_id`).join(', ')}. ` +
        `Run backend/src/config/migrations/2026-04-15-add-supabase-user-id-mapping.sql before reconciliation.`
      );
    }
  }

  static async reconcile(options = {}, actor = null) {
    const scope = ['users', 'restaurants'].includes(options.scope) ? options.scope : 'all';
    const createMissingUsers = options.createMissingUsers !== false;
    const linkByEmail = options.linkByEmail !== false;
    const report = await this.buildAudit(scope);

    this.ensureMappingColumnsAvailable(report, scope);

    const duplicateEmailSet = new Set([
      ...(report.users.duplicates || []).map((entry) => entry.email),
      ...(report.restaurants.duplicates || []).map((entry) => entry.email),
      ...(report.crossEntityDuplicates || []).map((entry) => entry.email),
    ]);

    const targetRecords = [
      ...(scope === 'restaurants' ? [] : report.users.records),
      ...(scope === 'users' ? [] : report.restaurants.records),
    ];

    const result = {
      scope,
      reconciledAt: new Date().toISOString(),
      linked: [],
      created: [],
      skipped: [],
      errors: [],
    };

    for (const record of targetRecords) {
      try {
        if (!record.email || duplicateEmailSet.has(record.email)) {
          result.skipped.push({
            table: record.table,
            id: record.id,
            email: record.email,
            reason: record.email ? 'duplicate_or_conflicting_email' : 'missing_email',
          });
          continue;
        }

        if (record.reconciliationStatus === 'linked') {
          result.skipped.push({
            table: record.table,
            id: record.id,
            email: record.email,
            reason: 'already_linked',
          });
          continue;
        }

        if (linkByEmail && record.authUserId && record.canAutoLink) {
          await AuthService.updateSupabaseUserMapping(record.table, { id: record.id }, record.authUserId);
          result.linked.push({
            table: record.table,
            id: record.id,
            email: record.email,
            supabaseUserId: record.authUserId,
            previousSupabaseUserId: record.mappedSupabaseUserId,
            reconciliationStatus: record.reconciliationStatus,
          });
          continue;
        }

        if (createMissingUsers && record.canAutoCreate) {
          const created = await this.createMissingAuthUser(record);
          await AuthService.updateSupabaseUserMapping(record.table, { id: record.id }, created.authUserId);
          result.created.push({
            table: record.table,
            id: record.id,
            email: record.email,
            supabaseUserId: created.authUserId,
            requiresPasswordReset: true,
          });
          continue;
        }

        result.skipped.push({
          table: record.table,
          id: record.id,
          email: record.email,
          reason: record.reconciliationStatus,
        });
      } catch (error) {
        logger.error('Auth reconciliation error', {
          table: record.table,
          id: record.id,
          email: record.email,
          error: error.message,
        });
        result.errors.push({
          table: record.table,
          id: record.id,
          email: record.email,
          error: error.message,
        });
      }
    }

    if (actor?.id || actor?.userId) {
      logger.info('Developer auth reconciliation completed', {
        actorId: actor?.id || actor?.userId,
        scope,
        linkedCount: result.linked.length,
        createdCount: result.created.length,
        skippedCount: result.skipped.length,
        errorCount: result.errors.length,
      });
    }

    return result;
  }
}

export default AuthReconciliationService;
