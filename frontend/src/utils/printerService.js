import { printHtmlDocument } from './printDocument';
import { getRestaurantPrinterSettings } from './printerConfig';
import { buildBillPrintHtml, buildKotPrintHtml } from './receiptTemplates';

async function ensureQzReady(qz) {
  if (!qz?.websocket?.isActive || !qz?.websocket?.connect) {
    throw new Error('QZ Tray is not available in this browser.');
  }

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }
}

async function printViaQz({ printerName, html, title }) {
  const qz = window.qz;
  await ensureQzReady(qz);

  const resolvedPrinter = await qz.printers.find(printerName);
  const config = qz.configs.create(resolvedPrinter, { jobName: title });
  await qz.print(config, [{ type: 'html', format: 'plain', data: html }]);
}

async function printViaLocalService({ serviceUrl, printerName, html, title, paperWidthMm }) {
  if (!serviceUrl) {
    throw new Error('Printer service URL is not configured.');
  }

  const response = await fetch(serviceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      printerName,
      html,
      title,
      paperWidthMm,
    }),
  });

  if (!response.ok) {
    throw new Error('Local print service rejected the print job.');
  }
}

async function dispatchPrinterJob({ printerName, restaurant, html, title }) {
  const settings = getRestaurantPrinterSettings(restaurant);

  if (!printerName) {
    throw new Error('Printer name is missing.');
  }

  if (settings.provider === 'qz') {
    await printViaQz({ printerName, html, title });
    return { mode: 'qz' };
  }

  if (settings.provider === 'local_service') {
    await printViaLocalService({
      serviceUrl: settings.serviceUrl,
      printerName,
      html,
      title,
      paperWidthMm: settings.receiptWidthMm,
    });
    return { mode: 'local_service' };
  }

  throw new Error('No direct printer integration is configured.');
}

function fallbackBrowserPrint({ html, title }) {
  const didPrint = printHtmlDocument(html, { title });
  if (!didPrint) {
    throw new Error('The browser blocked the print window.');
  }
}

export async function printBillReceipt({ order, restaurant, invoice, cashierName, fallbackToBrowser = true }) {
  if (!order && !invoice) {
    throw new Error('No bill data is available for printing.');
  }

  const settings = getRestaurantPrinterSettings(restaurant);
  const html = buildBillPrintHtml({ order, restaurant, invoice, cashierName });
  const title = invoice?.invoiceNumber || order?.invoiceNumber || order?.displayOrderNumber || 'Bill';

  if (settings.billPrinter?.enabled && settings.billPrinter?.name) {
    try {
      const result = await dispatchPrinterJob({
        printerName: settings.billPrinter.name,
        restaurant,
        html,
        title,
      });
      return { ok: true, mode: result.mode, fallback: false };
    } catch (error) {
      if (!fallbackToBrowser) {
        throw error;
      }
      fallbackBrowserPrint({ html, title });
      return { ok: true, mode: 'browser', fallback: true, error };
    }
  }

  if (fallbackToBrowser) {
    fallbackBrowserPrint({ html, title });
    return { ok: true, mode: 'browser', fallback: true };
  }

  throw new Error('Billing printer is not configured.');
}

export async function printKotReceipt({ ticket, order, restaurant, fallbackToBrowser = true }) {
  if (!ticket) {
    throw new Error('No kitchen ticket is available for printing.');
  }

  const settings = getRestaurantPrinterSettings(restaurant);
  const html = buildKotPrintHtml({ ticket, restaurant, order });
  const title = `KOT ${ticket?.sequence || ''}`.trim();
  const activePrinters = settings.kotPrinters.filter((printer) => printer.enabled && printer.name);

  if (activePrinters.length > 0) {
    const results = await Promise.allSettled(
      activePrinters.map((printer) =>
        dispatchPrinterJob({
          printerName: printer.name,
          restaurant,
          html,
          title,
        })
      )
    );

    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length === 0) {
      return { ok: true, mode: settings.provider, fallback: false };
    }

    if (!fallbackToBrowser) {
      throw failures[0].reason;
    }

    fallbackBrowserPrint({ html, title });
    return { ok: true, mode: 'browser', fallback: true, error: failures[0].reason };
  }

  if (fallbackToBrowser) {
    fallbackBrowserPrint({ html, title });
    return { ok: true, mode: 'browser', fallback: true };
  }

  throw new Error('No enabled KOT printers are configured.');
}

export async function autoPrintKot({ ticket, order, restaurant }) {
  const settings = getRestaurantPrinterSettings(restaurant);
  if (!settings.autoPrintKOT) {
    return { skipped: true };
  }
  return printKotReceipt({ ticket, order, restaurant, fallbackToBrowser: true });
}

export async function autoPrintBill({ order, restaurant, invoice, cashierName }) {
  const settings = getRestaurantPrinterSettings(restaurant);
  if (!settings.autoPrintBill) {
    return { skipped: true };
  }
  return printBillReceipt({ order, restaurant, invoice, cashierName, fallbackToBrowser: true });
}
