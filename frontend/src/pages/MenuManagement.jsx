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
    <div className="space-y-5 sm:space-y-6">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Menu Management</h1>
        {activeTab === 'items' && (
          <button
            onClick={handleAddItem}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        )}
        {activeTab === 'categories' && (
          <button
            onClick={() => setShowCategoryForm(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Add Category
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200">
        <button
          onClick={() => setActiveTab('items')}
          className={`shrink-0 px-4 py-3 font-semibold transition ${
            activeTab === 'items'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Menu Items ({items.length})
        </button>
        <button
          onClick={() => { setActiveTab('categories'); loadCategories(); }}
          className={`shrink-0 px-4 py-3 font-semibold transition ${
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
              <div key={item.id} className="card overflow-hidden p-4 transition hover:shadow-lg sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-1 sm:flex-row sm:items-start">
                    <div className="flex h-28 w-full items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 via-white to-slate-50 p-3 sm:h-20 sm:w-20 sm:flex-shrink-0">
                      <img
                        src={getMenuItemImageUrl(item)}
                        alt={item.name}
                        className="h-full w-full rounded-lg object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-semibold text-gray-900 sm:text-lg">
                            {item.name}
                          </h3>
                          <p className="mt-1 break-words text-sm leading-6 text-gray-600">
                            {item.description}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-left sm:text-right">
                          <p className="text-base font-bold text-gray-900">{formatCurrency(item.price)}</p>
                          <p className="text-xs text-gray-600">{item.preparationTime} mins</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.tags?.map((tag, i) => (
                          <span key={i} className="rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
                    <button
                      onClick={() => handleEditItem(item)}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-blue-600 transition hover:bg-blue-100"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                      <span className="text-sm font-medium sm:hidden">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-red-600 transition hover:bg-red-100"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="text-sm font-medium sm:hidden">Delete</span>
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4 sm:p-6">
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

            <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex h-24 w-full items-center justify-center rounded-lg bg-white p-3 sm:h-16 sm:w-16">
                      <img
                        src={formData.imagePreview || getMenuItemImageUrl(editingItem || { name: formData.name })}
                        alt={formData.name || 'Menu item preview'}
                        className="h-full w-full rounded-lg object-contain"
                      />
                    </div>
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

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null); setFormData(createEmptyFormData()); }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
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
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900">Add Category</h2>
              <button
                onClick={() => { setShowCategoryForm(false); setError(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4 p-4 sm:p-6">
              <input
                type="text"
                placeholder="Category Name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="input w-full"
                required
              />

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setShowCategoryForm(false); setError(null); }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
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

