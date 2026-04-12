import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, FileSpreadsheet, Loader, Upload, XCircle } from 'lucide-react';
import Button from '../common/Button';
import Card from '../common/Card';
import Modal from '../common/Modal';
import Toast from '../common/Toast';
import { menuAPI } from '../../services/apiEndpoints';

const HEADER_ALIASES = {
  name: ['name', 'item', 'item_name', 'item name', 'dish', 'dish_name', 'menu_item', 'menu item'],
  price: ['price', 'cost', 'amount', 'rate', 'mrp'],
  category: ['category', 'type', 'group', 'section'],
  description: ['description', 'details', 'about', 'item_description', 'desc'],
  image_url: ['image_url', 'image', 'imageurl', 'photo', 'photo_url'],
  is_veg: ['is_veg', 'veg', 'isveg', 'vegetarian', 'veg_flag'],
  preparation_time: ['preparation_time', 'prep_time', 'prep time', 'time', 'cook_time', 'cooking_time'],
};

const REQUIRED_FIELDS = ['name', 'price', 'category'];

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseNumericValue = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  const normalized = String(value || '').replace(/[^0-9.-]/g, '').trim();
  return normalized ? Number(normalized) : NaN;
};

const parseBooleanValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', 'yes', 'y', '1', 'veg', 'vegetarian'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', 'non-veg', 'non veg'].includes(normalized)) return false;
  return undefined;
};

const detectMapping = (headers = []) => {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return Object.entries(HEADER_ALIASES).reduce((mapping, [field, aliases]) => {
    const matchedHeader = normalizedHeaders.find(({ normalized }) =>
      aliases.map(normalizeHeader).includes(normalized)
    );
    mapping[field] = matchedHeader?.original || null;
    return mapping;
  }, {});
};

const parsePreviewRows = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((header) => set.add(header));
      return set;
    }, new Set())
  );
  const mapping = detectMapping(headers);

  return {
    headers,
    mapping,
    rows,
  };
};

const normalizeCategoryName = (value) => String(value || '').trim().toLowerCase();

const normalizeRowsForFallback = (rows = [], mapping = {}) => {
  const normalizedRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = String(mapping.name ? row[mapping.name] || '' : '').trim();
    const category = String(mapping.category ? row[mapping.category] || '' : '').trim();
    const price = parseNumericValue(mapping.price ? row[mapping.price] : '');

    if (!name) {
      errors.push({ row: rowNumber, reason: 'Missing name' });
      return;
    }

    if (!category) {
      errors.push({ row: rowNumber, reason: 'Missing category' });
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      errors.push({ row: rowNumber, reason: 'Missing price' });
      return;
    }

    const preparationTime = parseNumericValue(mapping.preparation_time ? row[mapping.preparation_time] : '');
    const isVeg = parseBooleanValue(mapping.is_veg ? row[mapping.is_veg] : '');
    const tags = isVeg === true ? ['veg'] : [];

    normalizedRows.push({
      rowNumber,
      name,
      category,
      price,
      description: String(mapping.description ? row[mapping.description] || '' : '').trim(),
      preparationTime: Number.isFinite(preparationTime) && preparationTime > 0 ? Math.round(preparationTime) : 15,
      tags,
    });
  });

  return { normalizedRows, rowErrors: errors };
};

const buildFallbackItemPayload = (row, categoryId) => {
  const normalizedName = String(row.name || '').trim();
  const normalizedDescription = String(row.description || '').trim();
  const numericPrice = Number(row.price);
  const numericPreparationTime = Number(row.preparationTime);

  if (!categoryId) {
    return { error: 'Missing category' };
  }

  if (normalizedName.length < 2) {
    return { error: 'Name must be at least 2 characters' };
  }

  if (normalizedName.length > 100) {
    return { error: 'Name is too long' };
  }

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return { error: 'Invalid price' };
  }

  const payload = {
    name: normalizedName,
    price: Number(numericPrice.toFixed(2)),
    categoryId,
    preparationTime:
      Number.isFinite(numericPreparationTime) && numericPreparationTime >= 1
        ? Math.min(120, Math.round(numericPreparationTime))
        : 15,
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
  };

  if (normalizedDescription) {
    payload.description = normalizedDescription.slice(0, 500);
  }

  return { payload };
};

const getFallbackItemErrorMessage = (error) => {
  const details = error?.response?.data?.errors?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((detail) => detail.message).join(' ');
  }

  return error?.response?.data?.message || 'Failed to create item';
};

export default function MenuBulkUpload({ onUploaded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState({ headers: [], mapping: {}, rows: [] });
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const [uploadResult, setUploadResult] = useState(null);

  const missingRequiredMappings = useMemo(
    () => REQUIRED_FIELDS.filter((field) => !preview.mapping?.[field]),
    [preview.mapping]
  );

  const previewRows = useMemo(() => preview.rows.slice(0, 5), [preview.rows]);

  const resetState = () => {
    setFile(null);
    setPreview({ headers: [], mapping: {}, rows: [] });
    setUploadResult(null);
    setSubmitting(false);
  };

  const closeModal = () => {
    setIsOpen(false);
    resetState();
  };

  const handleFileSelection = async (selectedFile) => {
    if (!selectedFile) {
      return;
    }

    const fileName = String(selectedFile.name || '').toLowerCase();
    if (!(fileName.endsWith('.csv') || fileName.endsWith('.xlsx'))) {
      setToast({ type: 'error', message: 'Only CSV and XLSX files are supported' });
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setToast({ type: 'error', message: 'File exceeds 5MB limit' });
      return;
    }

    try {
      const nextPreview = await parsePreviewRows(selectedFile);
      setFile(selectedFile);
      setPreview(nextPreview);
      setUploadResult(null);
      setToast({ type: '', message: '' });
    } catch {
      setToast({ type: 'error', message: 'Unable to read the selected file' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setToast({ type: 'error', message: 'Select a file first' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await menuAPI.bulkUpload(formData);
      setUploadResult(response.data.data);
      setToast({ type: 'success', message: 'Menu uploaded successfully' });
      await onUploaded?.();
    } catch (error) {
      if (error.response?.status === 404) {
        try {
          const { normalizedRows, rowErrors } = normalizeRowsForFallback(preview.rows, preview.mapping);
          const categoriesResponse = await menuAPI.getCategories();
          const existingCategories = categoriesResponse.data?.data?.categories || [];
          const categoryMap = new Map(
            existingCategories.map((category) => [normalizeCategoryName(category.name), category.id])
          );

          const missingCategories = Array.from(
            new Set(
              normalizedRows
                .map((row) => row.category)
                .filter(Boolean)
                .filter((category) => !categoryMap.has(normalizeCategoryName(category)))
            )
          );

          for (const categoryName of missingCategories) {
            const createResponse = await menuAPI.createCategory({ name: categoryName });
            const createdCategory = createResponse.data?.data;
            if (createdCategory?.id) {
              categoryMap.set(normalizeCategoryName(categoryName), createdCategory.id);
            }
          }

          let inserted = 0;
          const uploadErrors = [...rowErrors];

          for (const row of normalizedRows) {
            const categoryId = categoryMap.get(normalizeCategoryName(row.category));

            if (!categoryId) {
              uploadErrors.push({ row: row.rowNumber, reason: 'Category could not be resolved' });
              continue;
            }

            const { payload, error: payloadError } = buildFallbackItemPayload(row, categoryId);
            if (payloadError) {
              uploadErrors.push({ row: row.rowNumber, reason: payloadError });
              continue;
            }

            try {
              await menuAPI.createItem(payload);
              inserted += 1;
            } catch (itemError) {
              uploadErrors.push({
                row: row.rowNumber,
                reason: getFallbackItemErrorMessage(itemError),
              });
            }
          }

          const fallbackResult = {
            success: true,
            totalRows: preview.rows.length,
            inserted,
            skipped: preview.rows.length - inserted,
            errors: uploadErrors,
          };

          setUploadResult(fallbackResult);
          setToast({
            type: 'success',
            message: 'Menu uploaded successfully using compatibility mode',
          });
          await onUploaded?.();
          return;
        } catch (fallbackError) {
          setToast({
            type: 'error',
            message: fallbackError.response?.data?.message || 'Bulk upload compatibility mode failed',
          });
          return;
        }
      }

      setToast({
        type: 'error',
        message: error.response?.data?.message || 'Bulk upload failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {toast.message ? (
        <Toast
          type={toast.type || 'success'}
          message={toast.message}
          onClose={() => setToast({ type: '', message: '' })}
        />
      ) : null}

      <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsOpen(true)}>
        <Upload className="h-4 w-4" />
        Upload Menu
      </Button>

      <Modal title="Bulk Upload Menu" isOpen={isOpen} onClose={closeModal} maxWidth="max-w-5xl">
        <div className="space-y-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={async (event) => {
              event.preventDefault();
              setDragActive(false);
              await handleFileSelection(event.dataTransfer.files?.[0]);
            }}
            className={`rounded-[1.75rem] border-2 border-dashed p-6 text-center transition ${
              dragActive
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'border-[var(--border-color)] bg-[var(--bg-card-muted)]'
            }`}
          >
            <FileSpreadsheet className="mx-auto h-10 w-10 text-[var(--color-primary)]" />
            <p className="mt-3 text-base font-semibold text-[var(--text-primary)]">
              Drop CSV or XLSX here
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Only `name`, `category`, and `price` are required. Extra columns are ignored automatically.
            </p>
            <label className="mt-4 inline-flex cursor-pointer">
              <span className="inline-flex min-h-[2.875rem] items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]">
                Choose File
              </span>
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files?.[0])}
              />
            </label>
            {file ? (
              <p className="mt-3 text-sm text-[var(--text-primary)]">{file.name}</p>
            ) : null}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Detected Columns</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {preview.headers.length > 0 ? preview.headers.map((header) => (
                  <span
                    key={header}
                    className="rounded-full border border-[var(--border-color)] bg-[var(--color-panel-muted)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
                  >
                    {header}
                  </span>
                )) : (
                  <p className="text-sm text-[var(--text-secondary)]">No file parsed yet.</p>
                )}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Auto Mapping</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(preview.mapping || {}).map(([field, value]) => (
                  <div key={field} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize text-[var(--text-primary)]">
                        {field.replace('_', ' ')}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          REQUIRED_FIELDS.includes(field)
                            ? 'bg-rose-500/10 text-rose-300'
                            : 'bg-[var(--bg-card-muted)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {REQUIRED_FIELDS.includes(field) ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <span className={`text-sm ${value ? 'text-[var(--text-primary)]' : 'text-amber-400'}`}>
                      {value || 'Not detected'}
                    </span>
                  </div>
                ))}
              </div>
              {missingRequiredMappings.length > 0 ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Before upload, detect these required columns: {missingRequiredMappings.join(', ')}</span>
                </div>
              ) : null}
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Preview</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">First 5 parsed rows</p>
              </div>
              <span className="rounded-full border border-[var(--border-color)] bg-[var(--color-panel-muted)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]">
                {preview.rows.length} rows detected
              </span>
            </div>

            {previewRows.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border-color)] text-sm">
                  <thead className="bg-[var(--bg-card-muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-secondary)]">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-secondary)]">Price</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-secondary)]">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--text-secondary)]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {previewRows.map((row, index) => (
                      <tr key={`${index}-${row[preview.mapping.name] || 'row'}`}>
                        <td className="px-4 py-3 text-[var(--text-primary)]">{row[preview.mapping.name] || '-'}</td>
                        <td className="px-4 py-3 text-[var(--text-primary)]">{row[preview.mapping.price] || '-'}</td>
                        <td className="px-4 py-3 text-[var(--text-primary)]">{row[preview.mapping.category] || '-'}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row[preview.mapping.description] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">No preview available yet.</p>
            )}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Sample CSV Format</h3>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-[var(--bg-panel)] p-4 text-xs text-[var(--text-secondary)]">
name,price,category,description,image_url,is_veg,preparation_time
Paneer Tikka,260,Starters,Smoky cottage cheese,https://example.com/paneer.jpg,true,20
Veg Biryani,320,Main Course,Fragrant rice bowl,,true,25
            </pre>
          </Card>

          {uploadResult ? (
            <Card>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Upload Summary</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border-color)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Total Rows</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{uploadResult.totalRows}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border-color)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Inserted</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-400">{uploadResult.inserted}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border-color)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Skipped</p>
                  <p className="mt-2 text-xl font-semibold text-amber-400">{uploadResult.skipped}</p>
                </div>
              </div>

              {Array.isArray(uploadResult.errors) && uploadResult.errors.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <div className="flex items-center gap-2 text-[var(--text-primary)]">
                    <XCircle className="h-4 w-4 text-amber-400" />
                    <span className="font-medium">Error Summary</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {uploadResult.errors.slice(0, 8).map((error) => (
                      <p key={`${error.row}-${error.reason}`}>Row {error.row}: {error.reason}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || submitting || missingRequiredMappings.length > 0}
            >
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Menu
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
