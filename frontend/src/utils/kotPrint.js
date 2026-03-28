function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function groupItemsByStation(items = []) {
  const groups = new Map();

  items.forEach((item) => {
    const station = item.station || 'Main Kitchen';
    const bucket = groups.get(station) || [];
    bucket.push(item);
    groups.set(station, bucket);
  });

  return Array.from(groups.entries()).map(([station, stationItems]) => ({
    station,
    items: stationItems,
  }));
}

export function printKitchenTicket(ticket, options = {}) {
  if (typeof window === 'undefined' || !ticket) {
    return false;
  }

  const groupedStations = groupItemsByStation(ticket.items || []);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=800');
  if (!printWindow) {
    return false;
  }

  const title = escapeHtml(options.title || `KOT ${ticket.sequence || ''}`.trim());
  const displayOrderNumber = escapeHtml(ticket.displayOrderNumber || '');
  const tableLabel = ticket.tableNumber ? `Table ${escapeHtml(ticket.tableNumber)}` : 'Walk-in';
  const summary = escapeHtml(ticket.summary || '');
  const typeLabel = escapeHtml(String(ticket.type || 'send').toUpperCase());

  const stationMarkup = groupedStations
    .map(
      (group) => `
        <section class="station">
          <div class="station-header">
            <h2>${escapeHtml(group.station)}</h2>
            <span>${group.items.length} lines</span>
          </div>
          ${group.items
            .map(
              (item) => `
                <div class="item">
                  <div class="item-main">
                    <span class="qty">${escapeHtml(item.quantity)}x</span>
                    <span class="name">${escapeHtml(item.name)}</span>
                    <span class="action action-${escapeHtml(item.action || 'add')}">${escapeHtml(item.action || 'add')}</span>
                  </div>
                  ${item.modifiers?.length ? `<div class="meta">Modifiers: ${escapeHtml(item.modifiers.join(', '))}</div>` : ''}
                  ${item.note ? `<div class="meta">Note: ${escapeHtml(item.note)}</div>` : ''}
                </div>
              `
            )
            .join('')}
        </section>
      `
    )
    .join('');

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: "Courier New", monospace;
            margin: 0;
            padding: 24px;
            color: #111827;
            background: #ffffff;
          }
          .header {
            border-bottom: 2px dashed #111827;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title {
            font-size: 26px;
            font-weight: 700;
            margin: 0 0 6px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-size: 14px;
            margin-top: 4px;
          }
          .chip {
            display: inline-block;
            border: 1px solid #111827;
            padding: 3px 8px;
            font-size: 12px;
            font-weight: 700;
            margin-top: 8px;
          }
          .station {
            border: 1px dashed #6b7280;
            padding: 12px;
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .station-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px dashed #9ca3af;
            padding-bottom: 8px;
          }
          .station-header h2 {
            margin: 0;
            font-size: 18px;
          }
          .item {
            padding: 8px 0;
            border-bottom: 1px dotted #d1d5db;
          }
          .item:last-child {
            border-bottom: 0;
          }
          .item-main {
            display: flex;
            gap: 10px;
            font-size: 16px;
            font-weight: 700;
          }
          .qty {
            min-width: 44px;
          }
          .name {
            flex: 1;
          }
          .action {
            text-transform: uppercase;
            font-size: 12px;
            padding: 2px 6px;
            border: 1px solid #111827;
          }
          .meta {
            margin-top: 4px;
            font-size: 13px;
          }
          @media print {
            body {
              padding: 10px;
            }
          }
        </style>
      </head>
      <body>
        <header class="header">
          <p class="title">${title}</p>
          <div class="meta-row"><span>${displayOrderNumber}</span><span>${tableLabel}</span></div>
          <div class="meta-row"><span>${summary}</span><span>${new Date(ticket.createdAt || Date.now()).toLocaleString('en-IN')}</span></div>
          <span class="chip">${typeLabel}</span>
        </header>
        ${stationMarkup}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
