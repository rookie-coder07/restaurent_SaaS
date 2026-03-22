import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, QrCode, Code2, ExternalLink, Copy } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { tableAPI } from '../services/apiEndpoints';
import { buildQrMenuUrl } from '../utils/frontendUrl';

export default function QRTest() {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data: tablesData = {} } = useApi(() => tableAPI.getTables());
  const tables = tablesData?.tables || [];

  const generateQRUrl = (table) => {
    const url = buildQrMenuUrl({
      tableNumber: table.tableNumber,
      tableId: table.id,
    });
    setQrUrl(url);
    setSelectedTable(table);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-card-muted)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div>
          <h1 className="mb-2 text-3xl font-bold text-[var(--text-primary)]">QR Code Testing</h1>
          <p className="text-[var(--text-secondary)]">Generate and verify customer-facing QR links for your tables.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="glass-panel rounded-3xl p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
            <QrCode className="h-5 w-5" />
            Select a Table
          </h2>

          {tables.length === 0 ? (
            <p className="py-8 text-center text-[var(--text-secondary)]">No tables created yet. Go to Tables page to create one.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => generateQRUrl(table)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedTable?.id === table.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-card-muted)] hover:border-[var(--color-primary)]'
                  }`}
                >
                  <p className="break-words font-semibold text-[var(--text-primary)]">Table {table.tableNumber}</p>
                  <p className="text-sm text-[var(--text-secondary)]">Capacity: {table.seatCapacity}</p>
                  <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">{table.qrCode || `table=${table.tableNumber}`}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {qrUrl && (
          <div className="glass-panel rounded-3xl border-[var(--color-primary)]/20 p-4 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
              <Code2 className="h-5 w-5" />
              QR URL Generated
            </h2>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
                <p className="mb-2 text-xs text-[var(--text-secondary)]">Customer Access URL:</p>
                <p className="break-all font-mono text-sm text-[var(--color-primary)]">{qrUrl}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={copyToClipboard}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-4 py-3 text-white transition hover:brightness-110"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>

                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-white transition hover:brightness-110"
                >
                  <ExternalLink className="h-4 w-4" />
                  Test
                </a>
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4 text-sm">
                <p className="mb-2 font-semibold text-[var(--text-primary)]">Selected Table:</p>
                <div className="space-y-1 text-[var(--text-secondary)]">
                  <p>Table Number: {selectedTable.tableNumber}</p>
                  <p>Capacity: {selectedTable.seatCapacity}</p>
                  <p>Status: {selectedTable.status}</p>
                  <p>Location: {selectedTable.location}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-6">
        <h3 className="mb-3 font-bold text-amber-200">How to Test</h3>
        <ol className="list-inside list-decimal space-y-2 text-sm text-amber-100">
          <li>Select a table from the list.</li>
          <li>Open the generated QR URL using the Test button.</li>
          <li>Add a few items and verify the cart count and total update instantly.</li>
          <li>Open the cart drawer and confirm quantities, totals, and order actions work.</li>
        </ol>
      </div>
    </div>
  );
}
