import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { cacheManager } from '../utils/cacheManager.js';

const MENU_CACHE_TTL = 600;
const CATEGORIES_CACHE_TTL = 300;

export class MenuService {
  // ============ CATEGORIES ============
  
  static async createCategory(restaurantId, categoryData) {
    try {
      if (!restaurantId) return null;
      if (!categoryData) return null;
      if (!categoryData.name) return null;
      
      const { data: category, error } = await supabase
        .from('menu_categories')
        .insert([{
          restaurant_id: restaurantId,
          name: categoryData.name,
          description: categoryData?.description || '',
          display_order: categoryData?.displayOrder || 0,
        }])
        .select()
        .single();

      if (error || !category) return null;

      logger.info(`✅ Category created: ${category.id}`);
      return category;
    } catch (error) {
      logger.error('❌ Create category error:', error);
      throw error;
    }
  }

  static async getCategories(restaurantId) {
    try {
      if (!restaurantId) return [];
      
      const cacheKey = `categories:${restaurantId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: categories, error } = await supabase
        .from('menu_categories')
        .select('id, name, description, display_order, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .order('display_order', { ascending: true });

      if (error) return [];

      const result = categories || [];
      cacheManager.set(cacheKey, result, CATEGORIES_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get categories error:', error);
      throw error;
    }
  }

  static async updateCategory(restaurantId, categoryId, updateData) {
    try {
      if (!restaurantId) return null;
      if (!categoryId) return null;
      if (!updateData) return null;
      
      const { data: category, error } = await supabase
        .from('menu_categories')
        .update({
          name: updateData?.name || null,
          description: updateData?.description || '',
          display_order: updateData?.displayOrder || 0,
          updated_at: new Date(),
        })
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !category) return null;

      logger.info(`✅ Category updated: ${categoryId}`);
      return category;
    } catch (error) {
      logger.error('❌ Update category error:', error);
      throw error;
    }
  }

  static async deleteCategory(restaurantId, categoryId) {
    try {
      // Check if category has items
      const { count, error: countError } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('category_id', categoryId)
        .eq('status', 'active');

      if (countError) throw countError;

      if (count > 0) {
        throw new Error('Cannot delete category with active items');
      }

      const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      logger.info(`✅ Category deleted: ${categoryId}`);
      return { message: 'Category deleted successfully' };
    } catch (error) {
      logger.error('❌ Delete category error:', error);
      throw error;
    }
  }

  // ============ MENU ITEMS ============
  
  static async createMenuItem(restaurantId, itemData) {
    try {
      if (!restaurantId) return null;
      if (!itemData) return null;
      if (!itemData.name) return null;
      if (!itemData.price) return null;
      
      const { data: menuItem, error } = await supabase
        .from('menu_items')
        .insert([{
          restaurant_id: restaurantId,
          category_id: itemData?.categoryId || null,
          name: itemData.name,
          description: itemData?.description || '',
          price: itemData.price,
          preparation_time: itemData?.preparationTime || 0,
          tags: itemData?.tags ? itemData.tags.join(',') : '',
        }])
        .select()
        .single();

      if (error || !menuItem) return null;

      return {
        ...menuItem,
        tags: menuItem?.tags ? menuItem.tags.split(',') : [],
      };
    } catch (error) {
      logger.error('❌ Create menu item error:', error);
      throw error;
    }
  }

  static async getMenuItems(restaurantId, filters = {}) {
    try {
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      
      const cacheKey = `menu_items:${restaurantId}:${filters.categoryId || 'all'}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('menu_items')
        .select('id, name, description, price, category_id, preparation_time, tags, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active');

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      const { data: items, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const result = (items || []).map(item => ({
        ...item,
        tags: item.tags ? item.tags.split(',') : [],
      }));

      cacheManager.set(cacheKey, result, MENU_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get menu items error:', error);
      throw error;
    }
  }

  static async getMenuItemById(restaurantId, itemId) {
    try {
      if (!restaurantId) return null;
      if (!itemId) return null;
      
      const cacheKey = `menu_item:${itemId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: item, error } = await supabase
        .from('menu_items')
        .select('id, name, description, price, category_id, preparation_time, tags, status, created_at')
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !item) return null;

      const result = {
        ...item,
        tags: item?.tags ? item.tags.split(',') : [],
      };

      cacheManager.set(cacheKey, result, MENU_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get menu item error:', error);
      throw error;
    }
  }

  static async updateMenuItem(restaurantId, itemId, updateData) {
    try {
      if (!restaurantId) return null;
      if (!itemId) return null;
      if (!updateData) return null;
      
      const { data: item, error } = await supabase
        .from('menu_items')
        .update({
          name: updateData?.name || null,
          description: updateData?.description || '',
          price: updateData?.price || 0,
          preparation_time: updateData?.preparationTime || 0,
          tags: updateData?.tags ? updateData.tags.join(',') : '',
          updated_at: new Date(),
        })
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !item) return null;

      return {
        ...item,
        tags: item?.tags ? item.tags.split(',') : [],
      };
    } catch (error) {
      logger.error('❌ Update menu item error:', error);
      throw error;
    }
  }

  static async deleteMenuItem(restaurantId, itemId) {
    try {
      if (!restaurantId) return null;
      if (!itemId) return null;
      
      const { error } = await supabase
        .from('menu_items')
        .update({ status: 'inactive' })
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId);

      if (error) return null;

      logger.info(`✅ Menu item deleted: ${itemId}`);
      return { message: 'Menu item deleted successfully' };
    } catch (error) {
      logger.error('❌ Delete menu item error:', error);
      throw error;
    }
  }

  static async toggleMenuItemStatus(restaurantId, itemId) {
    try {
      if (!restaurantId) return null;
      if (!itemId) return null;
      
      const { data: item } = await supabase
        .from('menu_items')
        .select('status')
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!item) return null;

      const newStatus = item?.status === 'active' ? 'inactive' : 'active';

      const { data: updated, error } = await supabase
        .from('menu_items')
        .update({ status: newStatus, updated_at: new Date() })
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !updated) return null;

      return {
        ...updated,
        tags: updated?.tags ? updated.tags.split(',') : [],
      };
    } catch (error) {
      logger.error('❌ Toggle status error:', error);
      throw error;
    }
  }

  // Search menu items
  static async searchMenuItems(restaurantId, searchTerm) {
    try {
      if (!restaurantId) return [];
      if (!searchTerm || searchTerm.trim() === '') return [];
      
      const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);

      if (error) return [];

      return (items || []).map(item => ({
        ...item,
        tags: item?.tags ? item.tags.split(',') : [],
      }));
    } catch (error) {
      logger.error('❌ Search menu items error:', error);
      throw error;
    }
  }
}

export default MenuService;
