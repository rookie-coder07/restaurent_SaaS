// Production Safety & Retry Engine

export class ProductionSafetyEngine {
  constructor() {
    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    };
    this.requestLog = new Map();
  }

  // Retry logic with exponential backoff
  async executeWithRetry(fn, operationName, onRetry) {
    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = attempt === this.retryConfig.maxAttempts - 1;
        
        if (isLastAttempt) {
          throw error;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        );

        if (onRetry) {
          onRetry({ attempt: attempt + 1, delay, error });
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Prevent duplicate requests
  canExecuteRequest(requestId) {
    if (this.requestLog.has(requestId)) {
      const lastExecution = this.requestLog.get(requestId);
      if (Date.now() - lastExecution < 1000) {
        return false; // Duplicate within 1s
      }
    }
    this.requestLog.set(requestId, Date.now());
    
    // Cleanup old entries
    if (this.requestLog.size > 1000) {
      const oldestKey = this.requestLog.keys().next().value;
      this.requestLog.delete(oldestKey);
    }
    
    return true;
  }

  // Validate response integrity
  validateResponse(response, requiredFields = []) {
    if (!response) return false;
    if (response.success === false) return false;
    
    for (const field of requiredFields) {
      if (response.data?.[field] === undefined) {
        return false;
      }
    }
    
    return true;
  }

  // Safe data extraction
  safeExtractData(response, path, defaultValue = null) {
    const keys = path.split('.');
    let current = response;
    
    for (const key of keys) {
      if (current == null) return defaultValue;
      current = current[key];
    }
    
    return current ?? defaultValue;
  }

  // Detect and prevent billing duplication
  trackBillingOperation(billId, operationType) {
    const key = `bill_${billId}_${operationType}`;
    if (this.requestLog.has(key)) {
      const lastTime = this.requestLog.get(key);
      if (Date.now() - lastTime < 5000) {
        return false;
      }
    }
    this.requestLog.set(key, Date.now());
    return true;
  }

  // Transaction safety check
  validateTransactionIntegrity(transaction) {
    const amountProvided = transaction?.amount !== undefined && transaction?.amount !== null;
    const checks = {
      hasOrderId: !!transaction?.orderId,
      hasPaymentMethod: !!transaction?.paymentMethod,
      ...(amountProvided && {
        hasAmount: transaction?.amount > 0,
        amountIsNumber: typeof transaction?.amount === 'number',
        amountNotNegative: transaction?.amount >= 0,
        amountNotInfinite: isFinite(transaction?.amount),
      }),
    };

    const failed = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([check]) => check);

    if (failed.length > 0) {
      throw new Error(`Transaction validation failed: ${failed.join(', ')}`);
    }

    return true;
  }
}

export const safetyEngine = new ProductionSafetyEngine();
