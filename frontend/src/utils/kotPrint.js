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
  const createdAtLabel = new Date(ticket.createdAt || Date.now()).toLocaleString('en-IN');

  const stationMarkup = groupedStations
    .map(
      (group) => `
        <section class="station">
          <div class="station-header">${escapeHtml(group.station)}</div>
          ${group.items
            .map(
              (item) => `
                <div class="item">
                  <div class="item-main">
                    <span class="name">${escapeHtml(item.name)}</span>
                    <span class="qty">${escapeHtml(item.quantity)} x</span>
                  </div>
                  ${item.modifiers?.length ? `<div class="meta">Mods: ${escapeHtml(item.modifiers.join(', '))}</div>` : ''}
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
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            color: #000000;
            background: #ffffff;
          }
          .kot {
            width: 80mm;
            margin: 0 auto;
            padding: 4mm;
            box-sizing: border-box;
          }
          .header {
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
            text-align: center;
          }
          .title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.08em;
            margin: 0;
          }
          .subline {
            font-size: 11px;
            margin-top: 4px;
            font-weight: 700;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 3px 8px;
            margin-top: 8px;
            font-size: 11px;
            text-align: left;
          }
          .meta-grid span:last-child {
            text-align: right;
          }
          .summary {
            margin-top: 6px;
            font-size: 11px;
            text-align: center;
          }
          .station {
            border-bottom: 1px dashed #000;
            padding: 8px 0;
            page-break-inside: avoid;
          }
          .station:last-child {
            border-bottom: 0;
          }
          .station-header {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 6px;
          }
          .item {
            padding: 6px 0;
            border-bottom: 1px dotted #999;
          }
          .item:last-child {
            border-bottom: 0;
          }
          .item-main {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 10px;
            font-size: 16px;
            font-weight: 800;
            line-height: 1.3;
          }
          .name {
            flex: 1;
          }
          .qty {
            min-width: 42px;
            text-align: right;
          }
          .meta {
            margin-top: 4px;
            font-size: 11px;
            line-height: 1.4;
          }
          @media print {
            body {
              padding: 0;
            }
            .kot {
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="kot">
          <header class="header">
            <p class="title">KOT</p>
            <div class="subline">${title}</div>
            <div class="meta-grid">
              <span>KOT No</span><span>${escapeHtml(ticket.sequence || '')}</span>
              <span>Order</span><span>${displayOrderNumber || '-'}</span>
              <span>Table</span><span>${tableLabel}</span>
              <span>Time</span><span>${escapeHtml(createdAtLabel)}</span>
              <span>Type</span><span>${typeLabel}</span>
            </div>
            ${summary ? `<div class="summary">${summary}</div>` : ''}
          </header>
          ${stationMarkup}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
