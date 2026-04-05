import QRCode from 'qrcode';
import { buildQrMenuUrl } from './frontendUrl';
import { printHtmlDocument } from './printDocument';

/**
 * Generate a QR code for a single table
 * @param {Object} table - Table object with tableNumber
 * @returns {Promise<string>} - Base64 encoded image data
 */
export const generateTableQRCode = async (table) => {
  try {
    const qrValue = buildQrMenuUrl({
      tableNumber: table.tableNumber,
      tableId: table.id,
    });

    return await QRCode.toDataURL(qrValue, {
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
  } catch (error) {
    console.error(`Error generating QR code for table ${table.tableNumber}:`, error);
    throw error;
  }
};

/**
 * Generate all QR codes as a print document
 * @param {Array} tables - Array of table objects
 * @param {string} restaurantName - Restaurant name
 */
export const generateBulkQRCodes = async (tables, restaurantName = 'Restaurant') => {
  try {
    const qrCodes = await Promise.all(
      tables.map(async (table) => ({
        tableNumber: table.tableNumber,
        seatCapacity: table.seatCapacity,
        location: table.location,
        qrImage: await generateTableQRCode(table),
      }))
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${restaurantName} - Table QR Codes</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
          }
          .container {
            background: white;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .header h1 {
            font-size: 32px;
            color: #333;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 14px;
          }
          .content {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
          }
          .qr-card {
            border: 2px solid #ddd;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            page-break-inside: avoid;
          }
          .qr-card h3 {
            font-size: 24px;
            color: #333;
            margin-bottom: 10px;
          }
          .qr-card-info {
            font-size: 12px;
            color: #666;
            margin-bottom: 15px;
            line-height: 1.6;
          }
          .qr-card img {
            width: 100%;
            max-width: 280px;
            height: auto;
            margin: 15px 0;
            border: 1px solid #ddd;
            padding: 5px;
            background: white;
          }
          .instructions {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #666;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            color: #999;
            font-size: 12px;
          }
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .container {
              padding: 20px;
              max-width: 100%;
            }
            .content {
              gap: 20px;
            }
            .qr-card {
              border: 1px solid #ccc;
              padding: 15px;
              page-break-inside: avoid;
            }
            .no-print {
              display: none;
            }
          }
          @page {
            margin: 10mm;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${restaurantName}</h1>
            <p>Table QR Code Reference Sheet</p>
            <p style="margin-top: 10px; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
          </div>

          <div class="content">
            ${qrCodes
              .map(
                (qr) => `
              <div class="qr-card">
                <h3>Table ${qr.tableNumber}</h3>
                <div class="qr-card-info">
                  <div><strong>Capacity:</strong> ${qr.seatCapacity} persons</div>
                  ${qr.location ? `<div><strong>Location:</strong> ${qr.location}</div>` : ''}
                </div>
                <img src="${qr.qrImage}" alt="QR Code for Table ${qr.tableNumber}" />
                <div class="instructions">
                  <p>Scan to access menu</p>
                </div>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="footer">
            <p>Print and place these QR codes on each table. Customers can scan them to view the menu and place orders.</p>
          </div>
        </div>

        <button
          onclick="window.print()"
          style="position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; z-index: 1000;"
          class="no-print"
        >
          Print
        </button>
      </body>
      </html>
    `;

    printHtmlDocument(htmlContent, {
      title: `${restaurantName} - Table QR Codes`,
    });
  } catch (error) {
    console.error('Error generating bulk QR codes:', error);
    throw error;
  }
};

/**
 * Download a single QR code as PNG
 * @param {Object} table - Table object
 * @param {string} imageData - Base64 image data from generateTableQRCode
 */
export const downloadQRCode = (table, imageData) => {
  const link = document.createElement('a');
  link.href = imageData;
  link.download = `table-${table.tableNumber}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
