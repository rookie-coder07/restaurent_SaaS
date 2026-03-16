import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export class MenuService {
  static transformCategory(category) {
    if (!category) return null;

    return {
      id: category.id,
      restaurantId: category.restaurant_id,
      name: category.name,
      description: category.description || '',
      displayOrder: category.display_order || 0,
      status: category.status || 'active',
      createdAt: category.created_at,
      updatedAt: category.updated_at,
    };
  }

  static transformMenuItem(item) {
    if (!item) return null;

    return {
      id: item.id,
      restaurantId: item.restaurant_id,
      categoryId: item.category_id,
      name: item.name,
      description: item.description || '',
      price: Number(item.price || 0),
      cloudinaryImageUrl: item.image_url || '',
      preparationTime: item.preparation_time || 15,
      tags: item.tags ? item.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      isAvailable: item.status === 'active',
      status: item.status || 'active',
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  // ============ CATEGORIES ============
  
  static async createCategory(restaurantId, categoryData) {
    try {
      const { data: category, error } = await supabase
        .from('menu_categories')
        .insert([{
          restaurant_id: restaurantId,
          name: categoryData.name,
          description: categoryData.description,
          display_order: categoryData.displayOrder || 0,
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Category created: ${category.id}`);
      return this.transformCategory(category);
    } catch (error) {
      logger.error('❌ Create category error:', error);
      throw error;
    }
  }

  static async getCategories(restaurantId) {
    try {
      const { data: categories, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .order('display_order', { ascending: true });

      if (error) throw error;

      return (categories || []).map((category) => this.transformCategory(category));
    } catch (error) {
      logger.error('❌ Get categories error:', error);
      throw error;
    }
  }

  static async updateCategory(restaurantId, categoryId, updateData) {
    try {
      const { data: category, error } = await supabase
        .from('menu_categories')
        .update({
          name: updateData.name,
          description: updateData.description,
          display_order: updateData.displayOrder,
          updated_at: new Date(),
        })
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !category) throw error || new Error('Category not found');

      logger.info(`✅ Category updated: ${categoryId}`);
      return this.transformCategory(category);
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
  
  static async createMenuItem(restaurantId, itemData, imageData = null) {
    try {
      const payload = {
        restaurant_id: restaurantId,
        category_id: itemData.categoryId || null,
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        preparation_time: itemData.preparationTime,
        tags: itemData.tags ? itemData.tags.join(',') : '',
      };

      if (imageData?.url) {
        payload.image_url = imageData.url;
      }

      const { data: menuItem, error } = await supabase
        .from('menu_items')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Menu item created: ${menuItem.id}`);
      return this.transformMenuItem(menuItem);
    } catch (error) {
      logger.error('❌ Create menu item error:', error);
      throw error;
    }
  }

  static async getMenuItems(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active');

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      const { data: items, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return (items || []).map((item) => this.transformMenuItem(item));
    } catch (error) {
      logger.error('❌ Get menu items error:', error);
      throw error;
    }
  }

  static async getMenuItemById(restaurantId, itemId) {
    try {
      const { data: item, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !item) throw error || new Error('Menu item not found');

      return this.transformMenuItem(item);
    } catch (error) {
      logger.error('❌ Get menu item error:', error);
      throw error;
    }
  }

  static async updateMenuItem(restaurantId, itemId, updateData, imageData = null) {
    try {
      const payload = {
        name: updateData.name,
        description: updateData.description,
        price: updateData.price,
        preparation_time: updateData.preparationTime,
        tags: updateData.tags ? updateData.tags.join(',') : '',
        updated_at: new Date(),
      };

      if (imageData?.url) {
        payload.image_url = imageData.url;
      }

      const { data: item, error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !item) throw error || new Error('Menu item not found');

      logger.info(`✅ Menu item updated: ${itemId}`);
      return this.transformMenuItem(item);
    } catch (error) {
      logger.error('❌ Update menu item error:', error);
      throw error;
    }
  }

  static async deleteMenuItem(restaurantId, itemId) {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ status: 'inactive' })
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      logger.info(`✅ Menu item deleted: ${itemId}`);
      return { message: 'Menu item deleted successfully' };
    } catch (error) {
      logger.error('❌ Delete menu item error:', error);
      throw error;
    }
  }

  static async toggleMenuItemStatus(restaurantId, itemId, isAvailable) {
    try {
      const { data: item } = await supabase
        .from('menu_items')
        .select('status')
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .single();

      const newStatus =
        typeof isAvailable === 'boolean'
          ? (isAvailable ? 'active' : 'inactive')
          : item?.status === 'active'
            ? 'inactive'
            : 'active';

      const { data: updated, error } = await supabase
        .from('menu_items')
        .update({ status: newStatus, updated_at: new Date() })
        .eq('id', itemId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Menu item status toggled: ${itemId} → ${newStatus}`);
      return this.transformMenuItem(updated);
    } catch (error) {
      logger.error('❌ Toggle status error:', error);
      throw error;
    }
  }

  // Search menu items
  static async searchMenuItems(restaurantId, searchTerm) {
    try {
      const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);

      if (error) throw error;

      return (items || []).map((item) => this.transformMenuItem(item));
    } catch (error) {
      logger.error('❌ Search menu items error:', error);
      throw error;
    }
  }
}

export default MenuService;
