function normalizePrinter(printer = {}, fallbackEnabled = false) {
  return {
    name: typeof printer?.name === 'string' ? printer.name.trim() : '',
    enabled: printer?.enabled ?? fallbackEnabled,
  };
}

export function getRestaurantPrinterSettings(restaurant = {}) {
  const printing = restaurant?.printing || {};
  const provider = printing.provider || restaurant?.printProvider || 'browser';
  const serviceUrl = printing.serviceUrl || restaurant?.printServiceUrl || '';
  const receiptWidthMm = [58, 80].includes(Number(printing.receiptWidthMm || restaurant?.receiptWidthMm))
    ? Number(printing.receiptWidthMm || restaurant?.receiptWidthMm)
    : 80;
  const autoPrintKOT = printing.autoPrintKOT ?? restaurant?.autoPrintKOT ?? false;
  const autoPrintBill = printing.autoPrintBill ?? restaurant?.autoPrintBill ?? false;
  const billPrinter = normalizePrinter(printing.billPrinter || restaurant?.billPrinter, false);
  const kotPrinters = Array.isArray(printing.kotPrinters || restaurant?.kotPrinters)
    ? (printing.kotPrinters || restaurant?.kotPrinters)
      .map((printer) => normalizePrinter(printer, true))
      .filter((printer) => printer.name || printer.enabled)
    : [];

  return {
    provider,
    serviceUrl,
    receiptWidthMm,
    autoPrintKOT,
    autoPrintBill,
    billPrinter,
    kotPrinters,
  };
}
