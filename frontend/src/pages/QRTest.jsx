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
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">QR Code Testing</h1>
          <p className="text-gray-600">Generate and verify customer-facing QR links for your tables.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-md">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
            <QrCode className="h-5 w-5" />
            Select a Table
          </h2>

          {tables.length === 0 ? (
            <p className="py-8 text-center text-gray-600">No tables created yet. Go to Tables page to create one.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => generateQRUrl(table)}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    selectedTable?.id === table.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-400'
                  }`}
                >
                  <p className="font-semibold text-gray-900">Table {table.tableNumber}</p>
                  <p className="text-sm text-gray-600">Capacity: {table.seatCapacity}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{table.qrCode || `table=${table.tableNumber}`}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {qrUrl && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
              <Code2 className="h-5 w-5" />
              QR URL Generated
            </h2>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="mb-2 text-xs text-gray-600">Customer Access URL:</p>
                <p className="break-all font-mono text-sm text-blue-600">{qrUrl}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-white transition hover:bg-blue-700"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>

                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-white transition hover:bg-emerald-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Test
                </a>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
                <p className="mb-2 font-semibold text-gray-900">Selected Table:</p>
                <div className="space-y-1 text-gray-700">
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

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h3 className="mb-3 font-bold text-amber-900">How to Test</h3>
        <ol className="list-inside list-decimal space-y-2 text-sm text-amber-900">
          <li>Select a table from the list.</li>
          <li>Open the generated QR URL using the Test button.</li>
          <li>Add a few items and verify the cart count and total update instantly.</li>
          <li>Open the cart drawer and confirm quantities, totals, and order actions work.</li>
        </ol>
      </div>
    </div>
  );
}
