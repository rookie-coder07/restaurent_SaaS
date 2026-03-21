import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { menuAPI } from '../services/apiEndpoints';
import { Plus, Edit2, Trash2, Loader, Upload, X, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { getMenuItemImageUrl } from '../utils/menuItemImage';

export default function MenuManagement() {
  const createEmptyFormData = () => ({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    preparationTime: '20',
    tags: '',
    image: null,
    imagePreview: '',
    imageName: '',
  });

  const { data: itemsData = {}, loading, execute: refetch } = useApi(() =>
    menuAPI.getItems({ limit: 100 })
  );

  const { data: categoriesData = {}, execute: loadCategories } = useApi(() =>
    menuAPI.getCategories()
  );

  const [activeTab, setActiveTab] = useState('items');
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState(createEmptyFormData());

  const items = itemsData?.items || [];
  const categories = categoriesData?.categories || [];

  const handleAddItem = () => {
    setError(null);
    setEditingItem(null);
    setFormData(createEmptyFormData());
    setShowForm(true);
  };

  const handleEditItem = (item) => {
    setError(null);
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price || '',
      categoryId: item.categoryId || '',
      preparationTime: item.preparationTime || '20',
      tags: (item.tags || []).join(', '),
      image: null,
      imagePreview: item.imageUrl || item.image_url || item.cloudinaryImageUrl || '',
      imageName: '',
    });
    setShowForm(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setError(null);
      setFormData((current) => ({
        ...current,
        image: typeof reader.result === 'string' ? reader.result : null,
        imagePreview: typeof reader.result === 'string' ? reader.result : current.imagePreview,
        imageName: file.name,
      }));
    };
    reader.onerror = () => {
      setError('Unable to read the selected image');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveSelectedImage = () => {
    setFormData((current) => ({
      ...current,
      image: null,
      imagePreview: editingItem
        ? editingItem.imageUrl || editingItem.image_url || editingItem.cloudinaryImageUrl || ''
        : '',
      imageName: '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const submitData = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        categoryId: formData.categoryId || '',
        preparationTime: Number(formData.preparationTime),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      };

      if (formData.image) {
        submitData.imageBase64 = formData.image;
      }

      if (editingItem) {
        await menuAPI.updateItem(editingItem.id, submitData);
        setSuccess('Item updated successfully');
      } else {
        await menuAPI.createItem(submitData);
        setSuccess('Item created successfully');
      }

      setShowForm(false);
      setFormData(createEmptyFormData());
      await refetch(); // Wait for data to reload
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await menuAPI.deleteItem(itemId);
        setSuccess('Item deleted successfully');
        await refetch(); // Wait for data to reload
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete item');
      }
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await menuAPI.createCategory({ name: newCategoryName });
      setSuccess('Category created successfully');
      setNewCategoryName('');
      setShowCategoryForm(false);
      await loadCategories(); // Wait for data to reload
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (confirm('Are you sure? This will affect items in this category.')) {
      try {
        await menuAPI.deleteCategory(categoryId);
        setSuccess('Category deleted successfully');
        await loadCategories(); // Wait for data to reload
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete category');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
        {activeTab === 'items' && (
          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        )}
        {activeTab === 'categories' && (
          <button
            onClick={() => setShowCategoryForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Add Category
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-3 font-semibold transition ${
            activeTab === 'items'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Menu Items ({items.length})
        </button>
        <button
          onClick={() => { setActiveTab('categories'); loadCategories(); }}
          className={`px-4 py-3 font-semibold transition ${
            activeTab === 'categories'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {/* Items List */}
      {activeTab === 'items' && (
        <div className="grid grid-cols-1 gap-4">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="card flex items-center justify-between hover:shadow-lg transition">
                <div className="flex items-center gap-4 flex-1">
                  <img
                    src={getMenuItemImageUrl(item)}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.description}</p>
                    <div className="flex gap-2 mt-1">
                      {item.tags?.map((tag, i) => (
                        <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="font-bold text-gray-900">{formatCurrency(item.price)}</p>
                    <p className="text-xs text-gray-600">{item.preparationTime} mins</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditItem(item)}
                      className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="card text-center py-12">
              <p className="text-gray-600 mb-4">No menu items yet</p>
              <button
                onClick={handleAddItem}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                Create First Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.length > 0 ? (
            categories.map((cat) => (
              <div key={cat.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                    <p className="text-sm text-gray-600">{cat.itemCount || 0} items</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full card text-center py-12">
              <p className="text-gray-600 mb-4">No categories yet</p>
              <button
                onClick={() => setShowCategoryForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                Create Category
              </button>
            </div>
          )}
        </div>
      )}

      {/* Form Modal - Item */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setError(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Item Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
                <input
                  type="number"
                  placeholder="Price (₹)"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input h-20"
              />

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Preparation Time (mins)"
                  value={formData.preparationTime}
                  onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                  className="input"
                  min="1"
                />
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="input"
                >
                  <option value="">Select Category (Optional)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                placeholder="Tags (comma-separated)"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="input"
              />

              <div className="space-y-3">
                <label
                  htmlFor="menu-item-image"
                  className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Click to upload image</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP supported</p>
                  <input
                    id="menu-item-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>

                {(formData.imagePreview || formData.imageName) && (
                  <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <img
                      src={formData.imagePreview || getMenuItemImageUrl(editingItem || { name: formData.name })}
                      alt={formData.name || 'Menu item preview'}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {formData.imageName || 'Current menu image'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formData.imageName ? 'New image selected and ready to upload' : 'Current image will be kept'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveSelectedImage}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null); setFormData(createEmptyFormData()); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  {editingItem ? 'Update' : 'Create'} Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Category</h2>
              <button
                onClick={() => { setShowCategoryForm(false); setError(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="p-6 space-y-4">
              <input
                type="text"
                placeholder="Category Name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="input w-full"
                required
              />

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => { setShowCategoryForm(false); setError(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

