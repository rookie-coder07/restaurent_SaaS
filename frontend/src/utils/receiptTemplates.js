import { buildInvoiceData } from './invoice';
import { formatCurrency } from './formatters';
import { getRestaurantPrinterSettings } from './printerConfig';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildPrintShell({ title, paperWidthMm, bodyMarkup }) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: ${paperWidthMm}mm auto; margin: 0; }
        html, body {
          width: 100%;
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #000000;
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: 0.01em;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: none;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        body {
          display: flex;
          justify-content: center;
          box-sizing: border-box;
        }
        .receipt {
          width: ${paperWidthMm}mm;
          max-width: ${paperWidthMm}mm;
          margin: 0 auto;
          padding: 4mm;
          box-sizing: border-box;
        }
        .center { text-align: center; }
        .title { font-size: 16px; font-weight: 800; }
        .subtitle { font-size: 13px; font-weight: 800; margin-top: 2px; }
        .muted { font-size: 11px; font-weight: 700; }
        .separator {
          white-space: pre;
          overflow: hidden;
          margin: 6px 0;
        }
        .meta {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 3px 8px;
        }
        .bill-head,
        .bill-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 38px 52px 58px;
          gap: 6px;
          align-items: start;
        }
        .kot-head,
        .kot-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 40px;
          gap: 6px;
          align-items: start;
        }
        .strong { font-weight: 800; }
        .right { text-align: right; }
        .item-name {
          white-space: normal;
          word-break: break-word;
        }
        .note {
          margin-top: 2px;
          font-size: 11px;
        }
        .summary {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 3px 8px;
        }
        .receipt, .receipt * {
          font-weight: inherit;
        }
      </style>
    </head>
    <body>
      <div class="receipt">${bodyMarkup}</div>
    </body>
  </html>`;
}

export function buildBillPrintHtml({ order, restaurant, invoice, cashierName }) {
  const resolvedInvoice = invoice || buildInvoiceData({ order, restaurant, cashierName });
  const { receiptWidthMm } = getRestaurantPrinterSettings(restaurant);

  const itemsMarkup = (resolvedInvoice.items || [])
    .map(
      (item) => `
        <div class="bill-row">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="right">${escapeHtml(item.quantity)}</span>
          <span class="right">${escapeHtml(formatCurrency(item.price))}</span>
          <span class="right strong">${escapeHtml(formatCurrency(item.total))}</span>
        </div>
      `
    )
    .join('');

  const loyaltySummary = resolvedInvoice.loyalty?.redeemedAmount
    ? `<div class="summary"><span>Loyalty</span><span>-${escapeHtml(formatCurrency(resolvedInvoice.loyalty.redeemedAmount))}</span></div>`
    : '';
  const totalDiscountAmount = Number(
    (resolvedInvoice.summary?.orderDiscountAmount || 0) + (resolvedInvoice.summary?.managerDiscountAmount || 0)
  );
  const discountSummary = totalDiscountAmount > 0
    ? `<div class="summary"><span>Discount</span><span>-${escapeHtml(formatCurrency(totalDiscountAmount))}</span></div>`
    : '';

  const qrMarkup = resolvedInvoice.paymentQrCodeUrl
    ? `<div class="center" style="margin-top:8px;"><img src="${escapeHtml(resolvedInvoice.paymentQrCodeUrl)}" alt="Payment QR" style="max-width:100%;height:auto;max-height:110px;" /></div>`
    : '';

  const bodyMarkup = `
    <div class="center">
      <div class="title">${escapeHtml(resolvedInvoice.restaurantName || 'Restaurant')}</div>
      ${resolvedInvoice.address ? `<div class="muted">${escapeHtml(resolvedInvoice.address)}</div>` : ''}
      ${(resolvedInvoice.phone || resolvedInvoice.gstin)
        ? `<div class="muted">${escapeHtml(
          `${resolvedInvoice.phone ? `Ph: ${resolvedInvoice.phone}` : ''}${resolvedInvoice.phone && resolvedInvoice.gstin ? ' | ' : ''}${resolvedInvoice.gstin ? `GSTIN: ${resolvedInvoice.gstin}` : ''}`
        )}</div>`
        : ''}
    </div>
    <div class="separator">--------------------------------</div>
    <div class="meta">
      <span>Bill No</span><span class="right">${escapeHtml(resolvedInvoice.invoiceNumber || '-')}</span>
      <span>Date & Time</span><span class="right">${escapeHtml(new Date(resolvedInvoice.invoiceDate || Date.now()).toLocaleString('en-IN'))}</span>
      <span>Order</span><span class="right">${escapeHtml(resolvedInvoice.orderNumber || '-')}</span>
      <span>Table</span><span class="right">${escapeHtml(resolvedInvoice.tableNumber || 'Walk-in')}</span>
    </div>
    <div class="separator">--------------------------------</div>
    <div class="bill-head strong">
      <span>ITEM</span><span class="right">QTY</span><span class="right">RATE</span><span class="right">AMT</span>
    </div>
    <div class="separator">--------------------------------</div>
    ${itemsMarkup}
    <div class="separator">--------------------------------</div>
    <div class="summary">
      <span>Subtotal</span><span>${escapeHtml(formatCurrency(resolvedInvoice.summary.subtotal))}</span>
      ${discountSummary}
      <span>Taxable</span><span>${escapeHtml(formatCurrency(resolvedInvoice.summary.taxableAmount))}</span>
      <span>CGST (${escapeHtml(resolvedInvoice.summary.cgstRate)}%)</span><span>${escapeHtml(formatCurrency(resolvedInvoice.summary.cgstAmount))}</span>
      <span>SGST (${escapeHtml(resolvedInvoice.summary.sgstRate)}%)</span><span>${escapeHtml(formatCurrency(resolvedInvoice.summary.sgstAmount))}</span>
      ${resolvedInvoice.summary.chargesTotal ? `<span>Charges</span><span>${escapeHtml(formatCurrency(resolvedInvoice.summary.chargesTotal))}</span>` : ''}
    </div>
    ${loyaltySummary}
    <div class="separator">--------------------------------</div>
    <div class="summary strong">
      <span>Final Amount</span><span>${escapeHtml(formatCurrency(resolvedInvoice.summary.grandTotal))}</span>
      <span>Paid Amount</span><span>${escapeHtml(formatCurrency(resolvedInvoice.paidAmount || resolvedInvoice.summary.grandTotal))}</span>
      <span>Payment</span><span>${escapeHtml(String(resolvedInvoice.paymentMethod || 'cash').toUpperCase())}</span>
    </div>
    ${qrMarkup}
  `;

  return buildPrintShell({
    title: `${resolvedInvoice.invoiceNumber || resolvedInvoice.orderNumber || 'Bill'} Receipt`,
    paperWidthMm: receiptWidthMm,
    bodyMarkup,
  });
}

export function buildKotPrintHtml({ ticket, restaurant, order }) {
  const { receiptWidthMm } = getRestaurantPrinterSettings(restaurant);
  const createdAt = ticket?.createdAt || order?.createdAt || Date.now();
  const itemsMarkup = (ticket?.items || [])
    .map(
      (item) => `
        <div class="kot-row">
          <span class="item-name strong">${escapeHtml(item.name)}</span>
          <span class="right strong">${escapeHtml(item.quantity)}</span>
        </div>
        ${item.modifiers?.length ? `<div class="note">Mods: ${escapeHtml(item.modifiers.join(', '))}</div>` : ''}
        ${item.note ? `<div class="note">Note: ${escapeHtml(item.note)}</div>` : ''}
      `
    )
    .join('');

  const bodyMarkup = `
    <div class="center">
      <div class="title">${escapeHtml(restaurant?.name || 'Restaurant')}</div>
      <div class="subtitle">KOT</div>
    </div>
    <div class="separator">--------------------------------</div>
    <div class="meta">
      <span>KOT No</span><span class="right">${escapeHtml(ticket?.sequence || '-')}</span>
      <span>Order</span><span class="right">${escapeHtml(ticket?.displayOrderNumber || order?.displayOrderNumber || '-')}</span>
      <span>Table</span><span class="right">${escapeHtml(ticket?.tableNumber || order?.tableNumber || 'Walk-in')}</span>
      <span>Type</span><span class="right">${escapeHtml(String(ticket?.type || 'send').toUpperCase())}</span>
      <span>Time</span><span class="right">${escapeHtml(new Date(createdAt).toLocaleString('en-IN'))}</span>
    </div>
    ${ticket?.summary ? `<div class="note" style="margin-top:6px;">${escapeHtml(ticket.summary)}</div>` : ''}
    <div class="separator">--------------------------------</div>
    <div class="kot-head strong">
      <span>ITEM</span><span class="right">QTY</span>
    </div>
    <div class="separator">--------------------------------</div>
    ${itemsMarkup}
  `;

  return buildPrintShell({
    title: `KOT ${ticket?.sequence || ''}`.trim(),
    paperWidthMm: receiptWidthMm,
    bodyMarkup,
  });
}
