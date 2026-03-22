import { useState } from 'react';
import {
  Download,
  Edit2,
  Loader,
  Plus,
  QrCode,
  TableProperties,
  Trash2,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { tableAPI } from '../services/apiEndpoints';
import QRCodeModal from '../components/QRCodeModal';
import { generateBulkQRCodes } from '../utils/qrCodeGenerator';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';

const TABLE_STATUS_META = {
  available: {
    label: 'Available',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  occupied: {
    label: 'Occupied',
    badge: 'bg-red-100 text-red-700',
  },
  reserved: {
    label: 'Reserved',
    badge: 'bg-sky-100 text-sky-700',
  },
};

export default function Tables() {
  const { data: tablesData = {}, loading, execute: refetch } = useApi(() => tableAPI.getTables({}));

  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedTableForQR, setSelectedTableForQR] = useState(null);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationTable, setReservationTable] = useState(null);
  const [formData, setFormData] = useState({
    tableNumber: '',
    seatCapacity: '',
    status: 'available',
    location: '',
  });
  const [reservationData, setReservationData] = useState({
    reservedBy: '',
    reservationTime: '',
  });

  const tables = tablesData?.tables || [];
  const availableCount = tables.filter((table) => table.status === 'available').length;
  const occupiedCount = tables.filter((table) => table.status === 'occupied').length;
  const reservedCount = tables.filter((table) => table.status === 'reserved').length;

  const resetTableForm = () => {
    setFormData({
      tableNumber: '',
      seatCapacity: '',
      status: 'available',
      location: '',
    });
    setEditingTable(null);
    setShowForm(false);
  };

  const handleAddTable = () => {
    setError(null);
    setEditingTable(null);
    setFormData({
      tableNumber: '',
      seatCapacity: '',
      status: 'available',
      location: '',
    });
    setShowForm(true);
  };

  const handleEditTable = (table) => {
    setError(null);
    setEditingTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      seatCapacity: table.seatCapacity,
      status: table.status || 'available',
      location: table.location || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const submitData = {
        tableNumber: Number(formData.tableNumber),
        seatCapacity: Number(formData.seatCapacity),
        location: formData.location,
      };

      if (editingTable) {
        await tableAPI.updateTable(editingTable.id, submitData);
        setSuccess('Table updated successfully');
      } else {
        await tableAPI.createTable(submitData);
        setSuccess('Table created successfully');
      }

      resetTableForm();
      await refetch();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save table');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!confirm('Are you sure you want to delete this table?')) return;

    try {
      await tableAPI.deleteTable(tableId);
      setSuccess('Table deleted successfully');
      await refetch();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete table');
    }
  };

  const handleStatusUpdate = async (tableId, newStatus) => {
    try {
      await tableAPI.updateTable(tableId, { status: newStatus });
      setSuccess(`Table status updated to ${newStatus}`);
      await refetch();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleShowQRCode = (table) => {
    setSelectedTableForQR(table);
    setShowQRModal(true);
  };

  const handleOpenReservation = (table) => {
    setReservationTable(table);
    setReservationData({
      reservedBy: table.reservedBy || '',
      reservationTime: table.reservationTime ? new Date(table.reservationTime).toISOString().slice(0, 16) : '',
    });
    setShowReservationForm(true);
  };

  const handleReserveTable = async (e) => {
    e.preventDefault();
    if (!reservationTable) return;

    try {
      setSubmitting(true);
      setError(null);
      await tableAPI.reserveTable(reservationTable.id, {
        reservedBy: reservationData.reservedBy,
        reservationTime: new Date(reservationData.reservationTime).toISOString(),
      });
      setSuccess('Table reserved successfully');
      setShowReservationForm(false);
      setReservationTable(null);
      await refetch();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reserve table');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseTable = async (tableId) => {
    try {
      await tableAPI.releaseTable(tableId);
      setSuccess('Table released successfully');
      await refetch();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to release table');
    }
  };

  const handleBulkExportQR = async () => {
    if (tables.length === 0) {
      setError('No tables to export');
      return;
    }

    try {
      setError(null);
      setSuccess('Generating QR codes...');
      await generateBulkQRCodes(tables, 'Your Restaurant');
      setSuccess('QR codes generated successfully');
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to export QR codes');
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
      {error ? <Toast type="error" message={error} /> : null}

      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.14),_transparent_35%),var(--color-surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Tables</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Manage your floor plan</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Track availability, generate QR codes, and reserve tables from a mobile-friendly command center.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {tables.length > 0 ? (
              <Button variant="secondary" onClick={handleBulkExportQR}>
                <Download className="h-4 w-4" />
                Export All QR Codes
              </Button>
            ) : null}
            <Button onClick={handleAddTable}>
              <Plus className="h-4 w-4" />
              Add Table
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Available" value={availableCount} subtitle="Ready for guests" tone="success" />
        <StatCard label="Occupied" value={occupiedCount} subtitle="Currently serving" tone="neutral" />
        <StatCard label="Reserved" value={reservedCount} subtitle="Saved for later" tone="primary" />
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={TableProperties}
          title="No tables configured"
          description="Create your first table to start using QR ordering and floor management."
          action={
            <Button onClick={handleAddTable}>
              <Plus className="h-4 w-4" />
              Create First Table
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {tables.map((table) => {
            const meta = TABLE_STATUS_META[table.status] || TABLE_STATUS_META.available;
            return (
              <Card key={table.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-2xl font-bold text-[var(--color-text)]">Table {table.tableNumber}</h3>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Capacity: {table.seatCapacity} persons</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
                  </div>

                  <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Location</p>
                        <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{table.location || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">QR Status</p>
                        <p className="mt-2 text-sm font-medium text-[var(--color-text)]">Ready to generate</p>
                      </div>
                    </div>

                    {table.reservedBy ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">Reserved for {table.reservedBy}</p>
                        {table.reservationTime ? <p className="mt-1">{new Date(table.reservationTime).toLocaleString()}</p> : null}
                      </div>
                    ) : null}
                  </div>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Update Status</span>
                    <select
                      value={table.status}
                      onChange={(e) => handleStatusUpdate(table.id, e.target.value)}
                      className="input"
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="reserved">Reserved</option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Button variant="secondary" onClick={() => handleShowQRCode(table)} className="w-full">
                      <QrCode className="h-4 w-4" />
                      QR Code
                    </Button>

                    {table.status === 'reserved' ? (
                      <Button variant="secondary" onClick={() => handleReleaseTable(table.id)} className="w-full">
                        Release
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => handleOpenReservation(table)} className="w-full">
                        Reserve
                      </Button>
                    )}

                    <Button variant="secondary" onClick={() => handleEditTable(table)} className="w-full">
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </Button>

                    <Button variant="danger" onClick={() => handleDeleteTable(table.id)} className="w-full">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showQRModal && selectedTableForQR ? (
        <QRCodeModal
          table={selectedTableForQR}
          restaurantName="Your Restaurant"
          onClose={() => {
            setShowQRModal(false);
            setSelectedTableForQR(null);
          }}
        />
      ) : null}

      <Modal
        title={editingTable ? 'Edit Table' : 'Add New Table'}
        isOpen={showForm}
        onClose={() => {
          resetTableForm();
          setError(null);
        }}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Table Number"
            type="number"
            value={formData.tableNumber}
            onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
            min="1"
            required
          />
          <Input
            label="Seat Capacity"
            type="number"
            value={formData.seatCapacity}
            onChange={(e) => setFormData({ ...formData, seatCapacity: e.target.value })}
            min="1"
            max="20"
            required
          />
          <Input
            label="Location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Window seat, corner, patio..."
          />
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-text)]">Initial Status</span>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input"
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
            </select>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="w-full sm:flex-1" onClick={resetTableForm}>
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:flex-1" disabled={submitting}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
              {editingTable ? 'Update Table' : 'Create Table'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title={reservationTable ? `Reserve Table ${reservationTable.tableNumber}` : 'Reserve Table'}
        isOpen={showReservationForm}
        onClose={() => {
          setShowReservationForm(false);
          setReservationTable(null);
        }}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleReserveTable} className="space-y-4">
          <Input
            label="Reserved By"
            value={reservationData.reservedBy}
            onChange={(e) => setReservationData({ ...reservationData, reservedBy: e.target.value })}
            required
          />
          <Input
            label="Reservation Time"
            type="datetime-local"
            value={reservationData.reservationTime}
            onChange={(e) => setReservationData({ ...reservationData, reservationTime: e.target.value })}
            required
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:flex-1"
              onClick={() => {
                setShowReservationForm(false);
                setReservationTable(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:flex-1" disabled={submitting}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
              Reserve Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
