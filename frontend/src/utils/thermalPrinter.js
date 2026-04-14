import { formatCurrency } from './formatters';

/**
 * Thermal Printer Optimizer
 * Generates instant, formatted print documents for 80mm thermal printers
 * Pure HTML + CSS for blazing-fast printing without API delays
 */

// ✅ PRINTER WIDTH CONFIGURATION
const PRINTER_WIDTHS = {
  '58mm': 32,   // 58mm thermal printer = ~32 characters per line
  '80mm': 48,   // 80mm thermal printer = ~48 characters per line
};

// Default to 80mm (most common)
let CURRENT_PRINTER_WIDTH = PRINTER_WIDTHS['80mm'];

/**
 * Set the printer width dynamically
 * @param {string} width - Printer width: '58mm' or '80mm'
 */
export function setPrinterWidth(width) {
  if (PRINTER_WIDTHS[width]) {
    CURRENT_PRINTER_WIDTH = PRINTER_WIDTHS[width];
  }
}

/**
 * Get the current printer width in characters
 */
export function getPrinterWidth() {
  return CURRENT_PRINTER_WIDTH;
}

/**
 * ✅ TASK 2: GENERATE DYNAMIC LINE
 * Generate a separator line that fills the entire printer width
 * @param {number} width - Width in characters (optional, uses current printer width)
 * @returns {string} Dynamic separator line
 */
export function generateSeparatorLine(width = CURRENT_PRINTER_WIDTH) {
  return '─'.repeat(Math.max(width - 2, 8)); // Account for padding, minimum 8 dashes
}

/**
 * Align text for thermal printer using monospace font
 * @param {string} left - Left-aligned text
 * @param {string} right - Right-aligned text
 * @param {number} width - Total width in characters
 * @returns {string} Aligned text line
 */
export function alignThermalText(left, right, width = CURRENT_PRINTER_WIDTH) {
  const leftStr = String(left || '').substring(0, width - 10);
  const rightStr = String(right || '').substring(0, 10);
  const padding = width - leftStr.length - rightStr.length;
  return leftStr + ' '.repeat(Math.max(padding, 1)) + rightStr;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Print instantly using window.open() for thermal 80mm printers
 * No API delays, no iframe overhead - pure speed
 * @param {string} html - HTML content to print
 * @param {string} title - Title for print window
 * @returns {void}
 */
export function instantPrint(html, title = 'Print') {
  const printWindow = window.open('', '_blank', 'width=580,height=600,menubar=no,toolbars=no,status=no');
  
  if (!printWindow) {
    console.error('Print window blocked by browser');
    return;
  }

  // Write HTML directly to window.document
  printWindow.document.write(html);
  printWindow.document.close();

  // Delay print slightly to allow rendering
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    // Don't close, let user decide
    // printWindow.close();
  }, 250);
}

/**
 * Generate thermal-optimized KOT HTML for instant printing
 * Designed for 80mm (280px width) thermal printers and 58mm printers
 * @param {Object} ticket - Kitchen ticket data
 * @param {Object} order - Order data
 * @param {Object} restaurant - Restaurant data
 * @param {string} printerWidth - Printer width: '58mm' or '80mm' (default: '80mm')
 * @returns {string} Complete HTML document
 */
export function generateKotPrintHtml({ ticket, order, restaurant, printerWidth = '80mm' }) {
  // ✅ Set printer width for dynamic line generation
  if (printerWidth && PRINTER_WIDTHS[printerWidth]) {
    setPrinterWidth(printerWidth);
  }
  const width = getPrinterWidth();
  const separatorLine = generateSeparatorLine(width);

  const createdAt = ticket?.createdAt || order?.createdAt || new Date();
  const timeStr = new Date(createdAt).toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemsHtml = (ticket?.items || [])
    .map((item) => {
      let html = `<div class="kot-item">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-qty">${escapeHtml(item.quantity)}</span>
      </div>`;

      if (item.modifiers?.length) {
        html += `<div class="item-mods">Mods: ${escapeHtml(item.modifiers.join(', '))}</div>`;
      }

      if (item.note) {
        html += `<div class="item-note">Note: ${escapeHtml(item.note)}</div>`;
      }

      return html;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KOT ${escapeHtml(ticket?.sequence || '')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 280px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.3;
      padding: 8px;
      background: #fff;
      color: #000;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    .receipt {
      width: 100%;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 8px;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
    }

    .restaurant-name {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }

    .kotlabel {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    .separator {
      display: flex;
      align-items: center;
      margin: 6px 0;
      font-size: 9px;
      letter-spacing: 1px;
      font-family: 'Courier New', monospace;
      white-space: pre;
    }

    .meta {
      font-size: 10px;
      margin: 4px 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 8px;
    }

    .meta-label {
      font-weight: 900;
      min-width: 45px;
    }

    .meta-value {
      text-align: right;
      font-weight: 700;
    }

    .items-header {
      display: grid;
      grid-template-columns: 1fr 30px;
      gap: 8px;
      font-weight: 900;
      font-size: 11px;
      margin: 6px 0;
      padding: 2px 0;
      border-bottom: 1px solid #000;
    }

    .items-header-item {
      font-weight: 900;
      text-align: left;
    }

    .items-header-qty {
      font-weight: 900;
      text-align: right;
    }

    .items-list {
      margin: 4px 0;
    }

    .kot-item {
      display: grid;
      grid-template-columns: 1fr 30px;
      gap: 8px;
      margin: 3px 0;
      font-weight: 700;
      align-items: start;
    }

    .item-name {
      font-weight: 900;
      word-break: break-word;
      line-height: 1.2;
    }

    .item-qty {
      font-weight: 900;
      text-align: right;
      font-size: 12px;
      min-width: 30px;
    }

    .item-mods {
      font-size: 9px;
      font-weight: 700;
      margin: 1px 0 1px 4px;
      font-style: italic;
    }

    .item-note {
      font-size: 9px;
      font-weight: 700;
      margin: 1px 0 1px 4px;
      font-style: italic;
    }

    .footer {
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #000;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
    }

    .thank-you {
      font-weight: 900;
      font-size: 12px;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    @media print {
      body {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .receipt {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div class="header">
      <div class="restaurant-name">${escapeHtml(restaurant?.name || 'RESTAURANT')}</div>
      <div class="kotlabel">● KITCHEN ORDER TICKET ●</div>
    </div>

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Metadata -->
    <div class="meta">
      <span class="meta-label">KOT NO</span>
      <span class="meta-value">${escapeHtml(ticket?.sequence || '-')}</span>
      <span class="meta-label">ORDER</span>
      <span class="meta-value">${escapeHtml(ticket?.displayOrderNumber || order?.displayOrderNumber || '-')}</span>
      <span class="meta-label">TABLE</span>
      <span class="meta-value">${escapeHtml(ticket?.tableNumber || order?.tableNumber || 'WALK-IN')}</span>
      <span class="meta-label">TIME</span>
      <span class="meta-value">${escapeHtml(timeStr)}</span>
    </div>

    ${ticket?.summary ? `<div style="font-size: 9px; margin: 4px 0; font-weight: 700; font-style: italic;">${escapeHtml(ticket.summary)}</div>` : ''}

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Items Header -->
    <div class="items-header">
      <div class="items-header-item">ITEM</div>
      <div class="items-header-qty">QTY</div>
    </div>
    
    <!-- Items -->
    <div class="items-list">
      ${itemsHtml}
    </div>

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Footer -->
    <div class="footer">
      <div class="thank-you">★ THANK YOU ★</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate thermal-optimized Bill HTML for instant printing
 * Designed for 80mm (280px width) thermal printers
 * @param {Object} order - Order data
 * @param {Object} restaurant - Restaurant data
 * @param {Object} invoice - Invoice data
 * @param {string} cashierName - Cashier name
 * @returns {string} Complete HTML document
 */
export function generateBillPrintHtml({ order, restaurant, invoice, cashierName, printerWidth = '80mm' }) {
  // ✅ Set printer width for dynamic line generation
  if (printerWidth && PRINTER_WIDTHS[printerWidth]) {
    setPrinterWidth(printerWidth);
  }
  const width = getPrinterWidth();
  const separatorLine = generateSeparatorLine(width);

  const isPaid = String(invoice?.paymentStatus || order?.paymentStatus || '').toLowerCase() === 'paid';
  const invoiceDate = new Date(invoice?.invoiceDate || order?.createdAt || Date.now());
  const dateStr = invoiceDate.toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const items = invoice?.items || [];
  const summary = invoice?.summary || {};

  const itemsHtml = items
    .map((item) => {
      const itemTotal = formatCurrency(item.total || 0);
      const itemPrice = formatCurrency(item.price || 0);
      const itemQty = String(item.quantity || 0);

      return `<div class="bill-item">
        <div class="bill-item-name">${escapeHtml(item.name)}</div>
        <div class="bill-item-details">
          <span>${escapeHtml(itemQty)} × ${itemPrice}</span>
          <span class="bill-item-total">${itemTotal}</span>
        </div>
      </div>`;
    })
    .join('');

  const discountAmount = Number(
    (invoice?.summary?.orderDiscountAmount || 0) + (invoice?.summary?.managerDiscountAmount || 0)
  );

  const discountHtml = discountAmount > 0 
    ? `<div class="bill-summary-row">
        <span>Discount</span>
        <span>-${escapeHtml(formatCurrency(discountAmount))}</span>
      </div>` 
    : '';

  const loyaltyHtml = invoice?.loyalty?.redeemedAmount
    ? `<div class="bill-summary-row">
        <span>Loyalty Redeem</span>
        <span>-${escapeHtml(formatCurrency(invoice.loyalty.redeemedAmount))}</span>
      </div>`
    : '';

  const cgstHtml = summary.cgstRate > 0
    ? `<div class="bill-summary-row">
        <span>CGST (${summary.cgstRate}%)</span>
        <span>${escapeHtml(formatCurrency(summary.cgstAmount || 0))}</span>
      </div>`
    : '';

  const sgstHtml = summary.sgstRate > 0
    ? `<div class="bill-summary-row">
        <span>SGST (${summary.sgstRate}%)</span>
        <span>${escapeHtml(formatCurrency(summary.sgstAmount || 0))}</span>
      </div>`
    : '';

  const chargesHtml = summary.chargesTotal
    ? `<div class="bill-summary-row">
        <span>Charges</span>
        <span>${escapeHtml(formatCurrency(summary.chargesTotal))}</span>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bill ${escapeHtml(invoice?.invoiceNumber || order?.displayOrderNumber || '')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 280px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.3;
      padding: 8px;
      background: #fff;
      color: #000;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    .receipt {
      width: 100%;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #000;
    }

    .restaurant-name {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }

    .bill-label {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    .address {
      font-size: 9px;
      font-weight: 700;
      margin-top: 2px;
    }

    .gstin {
      font-size: 8px;
      font-weight: 700;
      margin-top: 1px;
    }

    .separator {
      display: flex;
      align-items: center;
      margin: 6px 0;
      font-size: 9px;
      letter-spacing: 1px;
    }

    .bill-meta {
      font-size: 10px;
      margin: 4px 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 8px;
    }

    .bill-meta-label {
      font-weight: 900;
      min-width: 50px;
    }

    .bill-meta-value {
      text-align: right;
      font-weight: 700;
    }

    .bill-items-header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      font-weight: 900;
      font-size: 11px;
      margin: 6px 0;
      padding: 2px 0;
      border-bottom: 1px solid #000;
    }

    .bill-items-list {
      margin: 4px 0;
    }

    .bill-item {
      margin: 3px 0;
      font-weight: 700;
    }

    .bill-item-name {
      font-weight: 900;
      word-break: break-word;
      line-height: 1.2;
      margin-bottom: 1px;
    }

    .bill-item-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: 700;
    }

    .bill-item-total {
      font-weight: 900;
      text-align: right;
      min-width: 45px;
    }

    .bill-summary-title {
      font-weight: 900;
      font-size: 11px;
      margin-top: 4px;
      margin-bottom: 2px;
      padding-top: 2px;
      border-top: 1px solid #000;
    }

    .bill-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: 700;
      margin: 2px 0;
    }

    .bill-summary-row span:first-child {
      flex: 1;
    }

    .bill-summary-row span:last-child {
      text-align: right;
      min-width: 45px;
      font-weight: 700;
    }

    .bill-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 900;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
    }

    .bill-total span:last-child {
      text-align: right;
      min-width: 60px;
      font-size: 14px;
      font-weight: 900;
    }

    .payment-section {
      font-size: 10px;
      font-weight: 700;
      margin-top: 4px;
      padding: 4px 0;
      border-top: 1px solid #000;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }

    .payment-row span:last-child {
      text-align: right;
      min-width: 45px;
      font-weight: 900;
    }

    .payment-status {
      font-weight: 900;
      text-align: center;
      margin-top: 4px;
      font-size: 11px;
      letter-spacing: 0.5px;
    }

    .footer {
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #000;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
    }

    .thank-you {
      font-weight: 900;
      font-size: 12px;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    .cashier-info {
      font-size: 9px;
      font-weight: 700;
      margin-top: 2px;
    }

    @media print {
      body {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .receipt {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div class="header">
      <div class="restaurant-name">${escapeHtml(restaurant?.name || 'RESTAURANT')}</div>
      <div class="bill-label">✎ BILL ✎</div>
      ${restaurant?.address ? `<div class="address">${escapeHtml(restaurant.address)}</div>` : ''}
      ${restaurant?.gstin ? `<div class="gstin">GSTIN: ${escapeHtml(restaurant.gstin)}</div>` : ''}
    </div>

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Bill Metadata -->
    <div class="bill-meta">
      <span class="bill-meta-label">BILL NO</span>
      <span class="bill-meta-value">${escapeHtml(invoice?.invoiceNumber || '-')}</span>
      <span class="bill-meta-label">ORDER</span>
      <span class="bill-meta-value">${escapeHtml(invoice?.orderNumber || order?.displayOrderNumber || '-')}</span>
      <span class="bill-meta-label">DATE</span>
      <span class="bill-meta-value">${escapeHtml(dateStr)}</span>
      <span class="bill-meta-label">TABLE</span>
      <span class="bill-meta-value">${escapeHtml(invoice?.tableNumber || order?.tableNumber || 'WALK-IN')}</span>
    </div>

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Items Header -->
    <div class="bill-items-header">
      <span>ITEM</span>
      <span style="text-align: right;">AMOUNT</span>
    </div>

    <!-- Items -->
    <div class="bill-items-list">
      ${itemsHtml}
    </div>

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Summary Section -->
    <div class="bill-summary-title">SUMMARY</div>
    <div class="bill-summary-row">
      <span>Subtotal</span>
      <span>${escapeHtml(formatCurrency(summary.subtotal || 0))}</span>
    </div>
    ${discountHtml}
    ${loyaltyHtml}
    ${summary.taxableAmount ? `<div class="bill-summary-row">
      <span>Taxable</span>
      <span>${escapeHtml(formatCurrency(summary.taxableAmount))}</span>
    </div>` : ''}
    ${cgstHtml}
    ${sgstHtml}
    ${chargesHtml}

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Total -->
    <div class="bill-total">
      <span>TOTAL</span>
      <span>${escapeHtml(formatCurrency(summary.grandTotal || 0))}</span>
    </div>

    <!-- Payment Section -->
    <div class="payment-section">
      <div class="payment-row">
        <span>Paid Amount</span>
        <span>${escapeHtml(formatCurrency(isPaid ? (invoice?.paidAmount || summary.grandTotal) : 0))}</span>
      </div>
      <div class="payment-row">
        <span>Payment Mode</span>
        <span>${escapeHtml(String(invoice?.paymentMethod || 'CASH').toUpperCase())}</span>
      </div>
      <div class="payment-status">${isPaid ? '✓ PAID' : '⧗ PENDING'}</div>
    </div>

    <!-- ✅ DYNAMIC SEPARATOR LINE -->
    <div class="separator">${escapeHtml(separatorLine)}</div>

    <!-- Footer -->
    <div class="footer">
      <div class="thank-you">★ THANK YOU ★</div>
      ${cashierName ? `<div class="cashier-info">Cashier: ${escapeHtml(cashierName)}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Print KOT instantly using thermal-optimized HTML
 * @param {Object} params - Parameters object (ticket, order, restaurant, printerWidth)
 * @returns {void}
 */
export function printKotInstant({ ticket, order, restaurant, printerWidth = '80mm' }) {
  const html = generateKotPrintHtml({ ticket, order, restaurant, printerWidth });
  const title = `KOT ${ticket?.sequence || ''}`.trim();
  instantPrint(html, title);
}

/**
 * Print Bill instantly using thermal-optimized HTML
 * @param {Object} params - Parameters object (order, restaurant, invoice, cashierName, printerWidth)
 * @returns {void}
 */
export function printBillInstant({ order, restaurant, invoice, cashierName, printerWidth = '80mm' }) {
  const html = generateBillPrintHtml({ order, restaurant, invoice, cashierName, printerWidth });
  const title = invoice?.invoiceNumber || order?.displayOrderNumber || 'Bill';
  instantPrint(html, title);
}
