import { useEffect, useRef, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { buildQrMenuUrl } from '../utils/frontendUrl';

export default function QRCodeModal({ table, restaurantName, onClose }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!table || !canvasRef.current) return;

    const generateQR = async () => {
      setLoading(true);
      setError('');

      try {
        const qrValue = buildQrMenuUrl({
          tableNumber: table.tableNumber,
          tableId: table.id,
        });

        await QRCode.toCanvas(canvasRef.current, qrValue, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          quality: 0.95,
          margin: 2,
          width: 300,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        setLoading(false);
      } catch (err) {
        console.error('Error generating QR code:', err);
        setError('Failed to generate QR code');
        setLoading(false);
      }
    };

    generateQR();
  }, [table]);

  const handleDownload = () => {
    if (!canvasRef.current || loading || error) return;

    const link = document.createElement('a');
    link.href = canvasRef.current.toDataURL('image/png');
    link.download = `table-${table.tableNumber}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!canvasRef.current || loading || error) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrImage = canvasRef.current.toDataURL('image/png');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Table ${table.tableNumber} QR Code</title>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
            background: white;
          }
          .container {
            text-align: center;
          }
          h1 {
            margin: 20px 0 10px 0;
            font-size: 28px;
            color: #333;
          }
          p {
            margin: 5px 0;
            color: #666;
            font-size: 14px;
          }
          img {
            margin: 30px 0;
            border: 2px solid #ddd;
            padding: 10px;
            background: white;
          }
          .instructions {
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Table ${table.tableNumber}</h1>
          <p>${restaurantName || 'Restaurant'}</p>
          <img src="${qrImage}" alt="QR Code for Table ${table.tableNumber}" />
          <div class="instructions">
            <p><strong>Scan to Order</strong></p>
            <p>Customers can scan this QR code to access the menu</p>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const qrLink = buildQrMenuUrl({
    tableNumber: table.tableNumber,
    tableId: table.id,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            Table {table.tableNumber} - QR Code
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col items-center p-6">
          <div className="relative mb-6 rounded-lg bg-gray-50 p-4">
            <canvas
              ref={canvasRef}
              className={error ? 'hidden' : 'h-auto w-full'}
            />

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mb-6 w-full rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-sm text-gray-600">
                  <strong>Seat Capacity:</strong> {table.seatCapacity} persons
                </p>
                {table.location && (
                  <p className="mt-2 text-sm text-gray-600">
                    <strong>Location:</strong> {table.location}
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Link: <code className="rounded bg-white px-2 py-1 text-xs">{qrLink}</code>
                </p>
              </div>

              <div className="mb-6 w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm text-amber-800">
                  Customers can scan this QR code to access the menu and place orders.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-200 p-6">
          <button
            onClick={handleDownload}
            disabled={loading || !!error}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !!error}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:bg-gray-100"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
