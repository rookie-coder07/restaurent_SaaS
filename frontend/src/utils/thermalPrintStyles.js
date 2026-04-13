/**
 * Optimized CSS for Thermal Printing
 * Inline styles for instant rendering (no CSS parsing overhead)
 * Used by optimizedThermalPrinter.js
 */

export const thermalPrintStyles = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.6;
  width: 80mm;
  background: white;
  color: black;
  overflow: hidden;
}

.thermal-container {
  padding: 8px;
  width: 100%;
}

.header {
  text-align: center;
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 8px;
  line-height: 1.4;
}

.separator {
  text-align: center;
  letter-spacing: 2px;
  margin: 6px 0;
  opacity: 0.8;
  font-size: 10px;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
  margin: 6px 0;
  font-size: 10px;
  line-height: 1.4;
}

.meta-label {
  text-align: left;
}

.meta-value {
  text-align: right;
  font-weight: bold;
}

.items-header {
  display: grid;
  grid-template-columns: 1fr 40px;
  gap: 4px;
  font-weight: bold;
  margin-bottom: 4px;
  font-size: 10px;
}

.items-header-label {
  text-align: left;
}

.items-header-qty {
  text-align: right;
}

.item-row {
  display: grid;
  grid-template-columns: 1fr 40px;
  gap: 4px;
  font-size: 10px;
  line-height: 1.4;
  margin: 2px 0;
}

.item-name {
  text-align: left;
  word-break: break-word;
}

.item-qty {
  text-align: right;
  font-weight: bold;
  white-space: nowrap;
}

.totals {
  margin: 6px 0;
  font-size: 10px;
}

.total-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin: 2px 0;
  line-height: 1.4;
}

.total-label {
  text-align: left;
}

.total-amount {
  text-align: right;
  font-weight: bold;
  white-space: nowrap;
  min-width: 50px;
}

.total-final {
  font-size: 11px;
  font-weight: bold;
  border-top: 1px solid black;
  border-bottom: 1px solid black;
  padding: 4px 0;
  margin: 4px 0;
}

.footer {
  text-align: center;
  margin-top: 8px;
  font-size: 10px;
  line-height: 1.4;
}

.thank-you {
  font-weight: bold;
  font-size: 11px;
}

@media print {
  body {
    margin: 0;
    padding: 0;
    width: 80mm;
  }

  .thermal-container {
    padding: 0;
    margin: 0;
  }

  /* Hide scrollbars */
  ::-webkit-scrollbar {
    display: none;
  }

  /* Prevent page breaks */
  * {
    page-break-inside: avoid;
    page-break-after: avoid;
  }
}

/* Optimize for smaller printers (58mm) */
@media (max-width: 200px) {
  body {
    font-size: 10px;
  }

  .header {
    font-size: 11px;
  }

  .item-row {
    grid-template-columns: 1fr 30px;
    gap: 2px;
  }

  .meta-grid {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
`;

/**
 * Fast inline style generator
 * Eliminates CSS class lookup overhead
 */
export function generateInlineStyle(obj) {
  return Object.entries(obj)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}:${value}`;
    })
    .join(';');
}

/**
 * Pre-computed common inline styles
 */
export const inlineStyles = {
  container: generateInlineStyle({
    padding: '8px',
    width: '100%',
    fontFamily: "'Courier New', monospace",
    fontSize: '11px',
    lineHeight: '1.6',
  }),

  header: generateInlineStyle({
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '12px',
    marginBottom: '8px',
  }),

  separator: generateInlineStyle({
    textAlign: 'center',
    letterSpacing: '2px',
    margin: '6px 0',
    opacity: '0.8',
  }),

  itemRow: generateInlineStyle({
    display: 'grid',
    gridTemplateColumns: '1fr 40px',
    gap: '4px',
    fontSize: '10px',
    margin: '2px 0',
  }),

  footer: generateInlineStyle({
    textAlign: 'center',
    marginTop: '8px',
    fontSize: '10px',
  }),
};
