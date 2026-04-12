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

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

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

export default function MenuBulkUpload({ onUploaded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState({ headers: [], mapping: {}, rows: [] });
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const [uploadResult, setUploadResult] = useState(null);

  const missingRequiredMappings = useMemo(
    () => ['name', 'price', 'category'].filter((field) => !preview.mapping?.[field]),
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
              Flexible columns supported. Extra columns are ignored automatically.
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
                    <span className="text-sm font-medium capitalize text-[var(--text-primary)]">
                      {field.replace('_', ' ')}
                    </span>
                    <span className={`text-sm ${value ? 'text-[var(--text-primary)]' : 'text-amber-400'}`}>
                      {value || 'Not detected'}
                    </span>
                  </div>
                ))}
              </div>
              {missingRequiredMappings.length > 0 ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Missing required mapping: {missingRequiredMappings.join(', ')}</span>
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
              disabled={!file || submitting}
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
