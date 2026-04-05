import { useMemo, useState } from 'react';
import { AlertCircle, Edit2, Loader, Plus, Trash2, Upload } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { inventoryAPI, menuAPI } from '../services/apiEndpoints';
import { formatCurrency } from '../utils/formatters';
import { getMenuItemImageUrl } from '../utils/menuItemImage';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import Toast from '../components/common/Toast';

function createEmptyFormData() {
  return {
    name: '',
    description: '',
    price: '',
    categoryId: '',
    preparationTime: '20',
    tags: '',
    image: null,
    imagePreview: '',
    imageName: '',
    ingredients: [],
  };
}

function getApiErrorMessage(err, fallbackMessage) {
  const validationDetails = err?.response?.data?.errors?.details;
  if (Array.isArray(validationDetails) && validationDetails.length > 0) {
    return validationDetails.map((detail) => detail.message).join(' ');
  }

  return err?.response?.data?.message || fallbackMessage;
}

export default function MenuManagement() {
  const {
    data: itemsData = {},
    loading,
    error: itemsError,
    execute: refetchItems,
  } = useApi(() => menuAPI.getItems({ limit: 100 }));
  const {
    data: categoriesData = {},
    error: categoriesError,
    execute: refetchCategories,
  } = useApi(() => menuAPI.getCategories());
  const {
    data: inventoryData = {},
    error: inventoryError,
  } = useApi(inventoryAPI.getItems);

  const [activeTab, setActiveTab] = useState('items');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState(createEmptyFormData());

  const items = useMemo(
    () =>
      (itemsData?.items || []).map((item) => ({
        ...item,
        id: item.id || item._id || '',
        categoryId: item.categoryId || item.category_id || item.category?.id || item.category?._id || '',
      })),
    [itemsData]
  );

  const categories = useMemo(
    () =>
      (categoriesData?.categories || []).map((category) => ({
        ...category,
        id: category.id || category._id || '',
      })),
    [categoriesData]
  );
  const inventoryItems = useMemo(
    () => (inventoryData?.items || []).map((item) => ({ ...item, id: item.id || item._id || '' })),
    [inventoryData]
  );

  const categoryItemsMap = useMemo(() => {
    const map = new Map();

    items.forEach((item) => {
      const key = String(item.categoryId || '');
      if (!key) {
        return;
      }

      const currentItems = map.get(key) || [];
      currentItems.push(item);
      map.set(key, currentItems);
    });

    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedCategoryFilter === 'all') {
      return items;
    }

    return items.filter((item) => String(item.categoryId || '') === String(selectedCategoryFilter));
  }, [items, selectedCategoryFilter]);

  const availableItems = items.filter((item) => item.isAvailable).length;
  const unavailableItems = items.length - availableItems;
  const fetchError = error || itemsError || categoriesError || inventoryError;

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setEditingItem(null);
    setFormData(createEmptyFormData());
    setError(null);
  };

  const openNewItemModal = () => {
    resetMessages();
    setEditingItem(null);
    setFormData(createEmptyFormData());
    setShowItemModal(true);
  };

  const openEditItemModal = (item) => {
    resetMessages();
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      categoryId: item.categoryId || '',
      preparationTime: item.preparationTime || '20',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      image: null,
      imagePreview: item.imageUrl || item.image_url || item.cloudinaryImageUrl || '',
      imageName: '',
      ingredients: Array.isArray(item.ingredients)
        ? item.ingredients.map((ingredient) => ({
            itemId: ingredient.itemId || ingredient.inventoryItemId,
            quantity: ingredient.quantity || '',
            unit: ingredient.unit || 'g',
          }))
        : [],
    });
    setShowItemModal(true);
  };

  const handleAddIngredientRow = () => {
    setFormData((current) => ({
      ...current,
      ingredients: [...current.ingredients, { itemId: '', quantity: '', unit: 'g' }],
    }));
  };

  const handleIngredientChange = (index, field, value) => {
    setFormData((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
      ),
    }));
  };

  const handleRemoveIngredient = (index) => {
    setFormData((current) => ({
      ...current,
      ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index),
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
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
    reader.onerror = () => setError('Unable to read the selected image.');
    reader.readAsDataURL(file);
    event.target.value = '';
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

  const handleSubmitItem = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.categoryId) {
        setError('Please select a category before saving the item.');
        setSubmitting(false);
        return;
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        categoryId: formData.categoryId || '',
        preparationTime: Number(formData.preparationTime),
        tags: formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        ingredients: formData.ingredients
          .filter((ingredient) => ingredient.itemId && Number(ingredient.quantity) > 0)
          .map((ingredient) => ({
            itemId: ingredient.itemId,
            quantity: Number(ingredient.quantity),
            unit: ingredient.unit,
          })),
      };

      if (formData.image) {
        payload.imageBase64 = formData.image;
      }

      if (editingItem) {
        await menuAPI.updateItem(editingItem.id, payload);
        setSuccess('Item updated successfully.');
      } else {
        await menuAPI.createItem(payload);
        setSuccess('Item created successfully.');
      }

      closeItemModal();
      await refetchItems();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save item.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await menuAPI.deleteItem(itemId);
      setSuccess('Item deleted successfully.');
      await refetchItems();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete item.'));
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await menuAPI.createCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      setShowCategoryModal(false);
      setSuccess('Category created successfully.');
      await refetchCategories();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create category.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Are you sure? This will affect items in this category.')) {
      return;
    }

    try {
      await menuAPI.deleteCategory(categoryId);
      setSuccess('Category deleted successfully.');
      await refetchCategories();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete category.'));
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {fetchError ? <Toast type="error" message={fetchError} /> : null}

      <div className="flex justify-end">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {activeTab === 'items' ? (
            <Button className="w-full sm:w-auto" onClick={openNewItemModal}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={() => setShowCategoryModal(true)}>
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Items" value={items.length} subtitle="Across your full menu" iconTone="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
        <StatCard label="Available" value={availableItems} subtitle="Visible to customers" iconTone="bg-emerald-500/15 text-emerald-400" />
        <StatCard label="Categories" value={categories.length} subtitle="Used to organize dishes" iconTone="bg-cyan-500/15 text-cyan-400" />
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'items'
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Menu Items ({items.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('categories');
                refetchCategories().catch(() => {});
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'categories'
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Categories ({categories.length})
            </button>
        </div>

        <div className="pt-5">
          {activeTab === 'items' ? (
            items.length > 0 ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                      Filter Menu
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                      Browse items by category
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Narrow the list to a category so you can review dishes faster.
                    </p>
                  </div>

                  <label className="block w-full sm:max-w-xs">
                    <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Category</span>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(event) => setSelectedCategoryFilter(event.target.value)}
                      className="input"
                    >
                      <option value="all">All Categories ({items.length})</option>
                      {categories.map((category) => {
                        const count = (categoryItemsMap.get(String(category.id)) || []).length;
                        return (
                          <option key={category.id} value={category.id}>
                            {category.name} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {filteredItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredItems.map((item) => (
                      <Card key={item.id} className="overflow-hidden p-4 sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 flex-col gap-4 sm:flex-1 sm:flex-row sm:items-start">
                            <div className="flex h-28 w-full items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-3 sm:h-24 sm:w-24 sm:flex-shrink-0">
                              <img
                                src={getMenuItemImageUrl(item)}
                                alt={item.name}
                                className="h-full w-full rounded-xl object-contain"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <h3 className="break-words text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                                    {item.name}
                                  </h3>
                                  <p className="mt-1 break-words text-sm leading-6 text-[var(--text-secondary)]">
                                    {item.description || 'No description added yet.'}
                                  </p>
                                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                                    {categories.find((category) => String(category.id) === String(item.categoryId))?.name || 'Uncategorized'}
                                  </p>
                                </div>

                                <div className="shrink-0 rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-3 py-1.5">
                                  <p className="text-base font-bold text-[var(--text-primary)]">{formatCurrency(item.price)}</p>
                                  <p className="text-xs text-[var(--text-secondary)]">{item.preparationTime} mins</p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {(item.tags || []).length > 0 ? (
                                  item.tags.map((tag, index) => (
                                    <span
                                      key={`${item.id}-${tag}-${index}`}
                                      className="rounded-full border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs text-[var(--color-primary)]"
                                    >
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                                    No tags
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {(item.ingredients || []).length > 0 ? (
                                  item.ingredients.slice(0, 4).map((ingredient, index) => (
                                    <span
                                      key={`${item.id}-ingredient-${index}`}
                                      className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300"
                                    >
                                      {ingredient.inventoryItemName || 'Ingredient'} • {ingredient.quantity} {ingredient.unit}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                                    No recipe linked
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-color)] pt-3 sm:border-0 sm:pt-0">
                            <Button variant="secondary" className="px-3 py-2" onClick={() => openEditItemModal(item)}>
                              <Edit2 className="h-4 w-4" />
                              <span className="sm:hidden">Edit</span>
                            </Button>
                            <Button variant="danger" className="px-3 py-2" onClick={() => handleDeleteItem(item.id)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sm:hidden">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Plus}
                    title="No items in this category"
                    description="Try another category or add a new dish to this section."
                    action={
                      <Button onClick={openNewItemModal}>
                        <Plus className="h-4 w-4" />
                        Add Item
                      </Button>
                    }
                  />
                )}
              </div>
            ) : (
              <EmptyState
                icon={Plus}
                title="No menu items yet"
                description="Create your first item to start building the customer-facing menu."
                action={
                  <Button onClick={openNewItemModal}>
                    <Plus className="h-4 w-4" />
                    Create First Item
                  </Button>
                }
              />
            )
          ) : categories.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {categories.map((category) => (
                <Card key={category.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-[var(--text-primary)]">{category.name}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {(categoryItemsMap.get(String(category.id)) || []).length} items
                      </p>
                    </div>
                    <Button variant="danger" className="px-3 py-2" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {(categoryItemsMap.get(String(category.id)) || []).length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {categoryItemsMap.get(String(category.id)).slice(0, 4).map((item) => (
                        <span
                          key={item.id}
                          className="rounded-full border border-[var(--border-color)] bg-[var(--color-panel-muted)] px-3 py-1 text-xs text-[var(--text-primary)]"
                        >
                          {item.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Plus}
              title="No categories yet"
              description="Create categories to keep your dishes organized."
              action={
                <Button onClick={() => setShowCategoryModal(true)}>
                  <Plus className="h-4 w-4" />
                  Create Category
                </Button>
              }
            />
          )}
        </div>
      </Card>

      <Modal
        title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
        isOpen={showItemModal}
        onClose={closeItemModal}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmitItem} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Item Name"
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <Input
              label="Price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(event) => setFormData((current) => ({ ...current, price: event.target.value }))}
              required
            />
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Description</span>
            <textarea
              value={formData.description}
              onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
              className="input min-h-[96px] resize-y"
              placeholder="Describe the dish"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Preparation Time (mins)"
              type="number"
              min="1"
              value={formData.preparationTime}
              onChange={(event) => setFormData((current) => ({ ...current, preparationTime: event.target.value }))}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Category</span>
              <select
                value={formData.categoryId}
                onChange={(event) => setFormData((current) => ({ ...current, categoryId: event.target.value }))}
                className="input"
                required
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Input
            label="Tags"
            value={formData.tags}
            onChange={(event) => setFormData((current) => ({ ...current, tags: event.target.value }))}
            placeholder="Spicy, Bestseller, Vegan"
          />

          <div className="space-y-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Recipe Ingredients</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Link stock items so the system can auto-deduct when this dish is fired to kitchen.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={handleAddIngredientRow}>
                <Plus className="h-4 w-4" />
                Add Ingredient
              </Button>
            </div>

            {formData.ingredients.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                No ingredients linked yet. You can save the item without a recipe, then add it later.
              </p>
            ) : (
              <div className="space-y-3">
                {formData.ingredients.map((ingredient, index) => (
                  <div key={`ingredient-row-${index}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_auto]">
                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">Inventory Item</span>
                      <select
                        value={ingredient.itemId}
                        onChange={(event) => handleIngredientChange(index, 'itemId', event.target.value)}
                        className="input"
                      >
                        <option value="">Select item</option>
                        {inventoryItems.map((stockItem) => (
                          <option key={stockItem.id} value={stockItem.id}>
                            {stockItem.name} ({stockItem.quantity} {stockItem.unit})
                          </option>
                        ))}
                      </select>
                    </label>

                    <Input
                      label="Qty"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={ingredient.quantity}
                      onChange={(event) => handleIngredientChange(index, 'quantity', event.target.value)}
                    />

                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">Unit</span>
                      <select
                        value={ingredient.unit}
                        onChange={(event) => handleIngredientChange(index, 'unit', event.target.value)}
                        className="input"
                      >
                        {['kg', 'g', 'litre', 'ml', 'pieces'].map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </label>

                    <div className="flex items-end">
                      <Button type="button" variant="danger" className="w-full sm:w-auto" onClick={() => handleRemoveIngredient(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label
              htmlFor="menu-item-image"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-card-muted)] p-6 text-center transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
            >
              <Upload className="mb-3 h-8 w-8 text-[var(--color-primary)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">Click to upload image</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">PNG, JPG, WebP supported</p>
              <input
                id="menu-item-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>

            {(formData.imagePreview || formData.imageName) ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex h-24 w-full items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:h-20 sm:w-20">
                  <img
                    src={formData.imagePreview || getMenuItemImageUrl(editingItem || { name: formData.name })}
                    alt={formData.name || 'Menu item preview'}
                    className="h-full w-full rounded-lg object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {formData.imageName || 'Current menu image'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formData.imageName ? 'New image selected and ready to upload' : 'Current image will be kept'}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={handleRemoveSelectedImage}>
                  Remove
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeItemModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
              {editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Add Category"
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setError(null);
        }}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            required
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
