import { useState } from 'react';
import { QrCode, Code2, ExternalLink, Copy } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { tableAPI } from '../services/apiEndpoints';

export default function QRTest() {
  const [selectedTable, setSelectedTable] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data: tablesData = {} } = useApi(() => tableAPI.getTables());
  const tables = tablesData?.tables || [];

  const generateQRUrl = (table) => {
    const baseUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const url = `${baseUrl}/menu?table=${table.tableNumber}&tableId=${table.id}`;
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">QR Code Testing</h1>
        <p className="text-gray-600">Test the QR ordering system for your tables</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Table Selector */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Select a Table
          </h2>

          {tables.length === 0 ? (
            <p className="text-gray-600 py-8 text-center">No tables created yet. Go to Tables page to create one.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => generateQRUrl(table)}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    selectedTable?.id === table.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-400'
                  }`}
                  >
                  <p className="font-semibold text-gray-900">Table {table.tableNumber}</p>
                  <p className="text-sm text-gray-600">Capacity: {table.seatCapacity}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{table.qrCode || `table=${table.tableNumber}`}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* QR URL Display */}
        {qrUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Code2 className="w-5 h-5" />
              QR URL Generated
            </h2>

            <div className="space-y-4">
              <div className="bg-white rounded p-3 border border-gray-200">
                <p className="text-xs text-gray-600 mb-2">Customer Access URL:</p>
                <p className="text-sm font-mono text-blue-600 break-all">{qrUrl}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex-1"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>

                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  Test
                </a>
              </div>

              <div className="bg-white rounded p-3 border border-gray-200 text-sm">
                <p className="font-semibold text-gray-900 mb-2">Selected Table:</p>
                <div className="space-y-1 text-gray-700">
                  <p>• Table Number: {selectedTable.tableNumber}</p>
                  <p>• Capacity: {selectedTable.seatCapacity}</p>
                  <p>• Status: {selectedTable.status}</p>
                  <p>• Location: {selectedTable.location}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="font-bold text-amber-900 mb-3">📋 How to Test:</h3>
        <ol className="space-y-2 text-sm text-amber-900 list-decimal list-inside">
          <li>Select a table from the left panel</li>
          <li>Click "Test" button to open the customer menu</li>
          <li>Browse items and add to cart</li>
          <li>Verify cart calculation and quantities work</li>
          <li>The table parameter (<code className="bg-amber-100 px-1 rounded">table=</code>) will be passed to the menu</li>
        </ol>
      </div>
    </div>
  );
}
