import { useEffect, useRef, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';

export default function QRCodeModal({ table, restaurantName, onClose }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || !table) return;

    const generateQR = async () => {
      try {
        // Get frontend URL from environment variable (set in production)
        // Falls back to current domain in development
        const baseUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
        const qrValue = `${baseUrl}/menu?table=${table.tableNumber}`;
        console.log('📱 Generating QR Code URL:', qrValue, '(Table:', table.tableNumber, ')');
        console.log('📍 QR pointing to:', baseUrl);
        console.log('📍 Using VITE_FRONTEND_URL:', import.meta.env.VITE_FRONTEND_URL || 'Not set');

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
        setLoading(false);
      }
    };

    generateQR();
  }, [table]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.href = canvasRef.current.toDataURL('image/png');
    link.download = `table-${table.tableNumber}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;

    const printWindow = window.open('', '_blank');
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Table {table.tableNumber} - QR Code
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                />
              </div>

              {/* Table Info */}
              <div className="w-full text-center mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Seat Capacity:</strong> {table.seatCapacity} persons
                </p>
                {table.location && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Location:</strong> {table.location}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-3">
                  Link: <code className="bg-white px-2 py-1 rounded text-xs">
                    {window.location.origin}/menu?table={table.tableNumber}
                  </code>
                </p>
              </div>

              {/* Instructions */}
              <div className="w-full text-center mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  📲 Customers scan this QR code to access the menu and place orders
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={handlePrint}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 font-medium transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
