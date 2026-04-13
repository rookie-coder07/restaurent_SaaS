/**
 * Web Worker for offloading expensive calculations
 * Run bill calculations in background thread without blocking UI
 */

// Worker code - can be used with web workers
export const workerCode = `
  self.onmessage = function(e) {
    const { type, payload } = e.data;
    
    if (type === 'CALCULATE_BILL') {
      const result = calculateBill(payload);
      self.postMessage({ type: 'BILL_CALCULATED', result });
    }
    
    if (type === 'BATCH_CALCULATE') {
      const results = batchCalculate(payload);
      self.postMessage({ type: 'BATCH_CALCULATED', results });
    }
  };

  function calculateBill(data) {
    const {
      subtotal,
      discount,
      cgstRate,
      sgstRate,
      serviceCharge,
      packingCharge,
    } = data;

    const taxable = subtotal - discount;
    const cgst = taxable * (cgstRate / 100);
    const sgst = taxable * (sgstRate / 100);
    const total = subtotal - discount + cgst + sgst + serviceCharge + packingCharge;

    return {
      subtotal,
      discount,
      taxable,
      cgstRate,
      cgstAmount: parseFloat(cgst.toFixed(2)),
      sgstRate,
      sgstAmount: parseFloat(sgst.toFixed(2)),
      serviceCharge,
      packingCharge,
      total: parseFloat(total.toFixed(2)),
    };
  }

  function batchCalculate(items) {
    return items.map(calculateBill);
  }
`;

/**
 * Create an optimized worker pool for calculations
 */
export class CalculationWorkerPool {
  constructor(poolSize = 2) {
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = new Set();

    // Create worker pool
    for (let i = 0; i < poolSize; i++) {
      try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        this.workers.push(worker);
      } catch (e) {
        console.warn('Web Workers not available, calculations will run on main thread');
      }
    }
  }

  /**
   * Get next available worker
   */
  getAvailableWorker() {
    for (const worker of this.workers) {
      if (!this.activeWorkers.has(worker)) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Execute calculation in worker or fallback to main thread
   */
  async calculateBill(data) {
    const worker = this.getAvailableWorker();

    if (!worker) {
      // Fallback: calculate on main thread if no workers available
      return fallbackCalculateBill(data);
    }

    return new Promise((resolve) => {
      this.activeWorkers.add(worker);

      const handler = (e) => {
        if (e.data.type === 'BILL_CALCULATED') {
          this.activeWorkers.delete(worker);
          worker.removeEventListener('message', handler);
          resolve(e.data.result);
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'CALCULATE_BILL', payload: data });
    });
  }

  /**
   * Batch calculate multiple bills
   */
  async batchCalculateBills(items) {
    const worker = this.getAvailableWorker();

    if (!worker) {
      return items.map(fallbackCalculateBill);
    }

    return new Promise((resolve) => {
      this.activeWorkers.add(worker);

      const handler = (e) => {
        if (e.data.type === 'BATCH_CALCULATED') {
          this.activeWorkers.delete(worker);
          worker.removeEventListener('message', handler);
          resolve(e.data.results);
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'BATCH_CALCULATE', payload: items });
    });
  }

  /**
   * Cleanup workers
   */
  terminate() {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.activeWorkers.clear();
  }
}

/**
 * Fallback calculation on main thread
 */
function fallbackCalculateBill(data) {
  const { subtotal, discount, cgstRate, sgstRate, serviceCharge, packingCharge } = data;
  const taxable = subtotal - discount;
  const cgst = taxable * (cgstRate / 100);
  const sgst = taxable * (sgstRate / 100);
  return {
    subtotal,
    discount,
    taxable,
    cgstAmount: parseFloat(cgst.toFixed(2)),
    sgstAmount: parseFloat(sgst.toFixed(2)),
    serviceCharge,
    packingCharge,
    total: parseFloat((subtotal - discount + cgst + sgst + serviceCharge + packingCharge).toFixed(2)),
  };
}

// Global worker pool instance
export const workerPool = new CalculationWorkerPool(2);
