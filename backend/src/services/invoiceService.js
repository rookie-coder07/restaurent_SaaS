import supabase from '../config/supabase.js';

export class InvoiceService {
  static DEFAULT_PREFIX = 'INV';

  static DEFAULT_STARTING_NUMBER = 1001;

  static normalizePrefix(value = this.DEFAULT_PREFIX) {
    const normalizedValue = String(value || this.DEFAULT_PREFIX).trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(normalizedValue)) {
      throw new Error('Invoice prefix must contain only uppercase letters, numbers, or hyphens');
    }

    return normalizedValue;
  }

  static normalizeStartingNumber(value, { fallback = this.DEFAULT_STARTING_NUMBER } = {}) {
    const normalizedValue = value === undefined || value === null || value === '' ? fallback : Number(value);

    if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
      throw new Error('Invoice starting number must be a whole number greater than zero');
    }

    return normalizedValue;
  }

  static mapCounterRow(row = {}, restaurantId = '') {
    return {
      restaurantId: row.restaurant_id || restaurantId,
      prefix: row.prefix || this.DEFAULT_PREFIX,
      nextNumber: Number(row.next_number || this.DEFAULT_STARTING_NUMBER),
    };
  }

  static isSchemaMissingError(error) {
    const combined = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return (
      combined.includes('invoice_counters') ||
      combined.includes('get_next_invoice_number') ||
      combined.includes('set_invoice_counter_config') ||
      combined.includes('does not exist')
    );
  }

  static async getInvoiceCounter(restaurantId) {
    const { data, error } = await supabase
      .from('invoice_counters')
      .select('restaurant_id, prefix, next_number')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      if (this.isSchemaMissingError(error)) {
        return {
          restaurantId,
          prefix: this.DEFAULT_PREFIX,
          nextNumber: this.DEFAULT_STARTING_NUMBER,
        };
      }

      throw error;
    }

    if (!data) {
      return {
        restaurantId,
        prefix: this.DEFAULT_PREFIX,
        nextNumber: this.DEFAULT_STARTING_NUMBER,
      };
    }

    return this.mapCounterRow(data, restaurantId);
  }

  static async updateInvoiceSettings(restaurantId, settings = {}) {
    const prefix = this.normalizePrefix(settings.prefix ?? this.DEFAULT_PREFIX);
    const startingNumber = this.normalizeStartingNumber(settings.startingNumber, {
      fallback: this.DEFAULT_STARTING_NUMBER,
    });

    const { data, error } = await supabase.rpc('set_invoice_counter_config', {
      p_restaurant_id: restaurantId,
      p_prefix: prefix,
      p_starting_number: startingNumber,
    });

    if (error) {
      if (this.isSchemaMissingError(error)) {
        throw new Error(
          'Database schema is missing the invoice counter setup. Run backend/src/config/migrations/2026-04-06-add-invoice-counter.sql and retry.'
        );
      }

      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return this.mapCounterRow(result, restaurantId);
  }

  static async generateNextInvoiceNumber(restaurantId) {
    const { data, error } = await supabase.rpc('get_next_invoice_number', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      if (this.isSchemaMissingError(error)) {
        throw new Error(
          'Database schema is missing the invoice counter setup. Run backend/src/config/migrations/2026-04-06-add-invoice-counter.sql and retry.'
        );
      }

      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.formatted_invoice_number) {
      throw new Error('Failed to generate invoice number');
    }

    return {
      prefix: result.prefix || this.DEFAULT_PREFIX,
      sequenceNumber: Number(result.invoice_number || 0),
      invoiceNumber: result.formatted_invoice_number,
    };
  }
}

export default InvoiceService;
