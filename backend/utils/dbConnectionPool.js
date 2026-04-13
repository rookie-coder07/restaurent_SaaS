/**
 * Database Connection Pool Manager
 * Reuses connections and manages pool state for optimal performance
 */

class DatabaseConnectionPool {
  constructor(maxConnections = 10, idleTimeout = 60000) {
    this.maxConnections = maxConnections;
    this.idleTimeout = idleTimeout;
    this.availableConnections = [];
    this.inUseConnections = new Set();
    this.waiting = [];
    this.stats = {
      created: 0,
      reused: 0,
      destroyed: 0,
    };
  }

  /**
   * Get or create a database connection
   * @param {Function} connectionFactory - Function that creates new connections
   * @returns {Promise<any>} - Database connection
   */
  async getConnection(connectionFactory) {
    // Try to get an available connection
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop();
      this.inUseConnections.add(connection);
      this.stats.reused++;
      return connection;
    }

    // If we can create more connections, do so
    if (this.inUseConnections.size < this.maxConnections) {
      const connection = await connectionFactory();
      this.inUseConnections.add(connection);
      this.stats.created++;
      return connection;
    }

    // Wait for a connection to be available
    return new Promise((resolve) => {
      this.waiting.push({ resolve, timestamp: Date.now() });
    });
  }

  /**
   * Release a connection back to the pool
   * @param {any} connection - The connection to release
   */
  releaseConnection(connection) {
    this.inUseConnections.delete(connection);

    // If someone is waiting, give them this connection
    if (this.waiting.length > 0) {
      const { resolve } = this.waiting.shift();
      this.inUseConnections.add(connection);
      resolve(connection);
    } else {
      // Otherwise, add to available pool
      this.availableConnections.push(connection);

      // Set timeout to close idle connections
      setTimeout(() => {
        const index = this.availableConnections.indexOf(connection);
        if (index !== -1) {
          this.availableConnections.splice(index, 1);
          this.closeConnection(connection);
        }
      }, this.idleTimeout);
    }
  }

  /**
   * Close a connection
   * @param {any} connection - The connection to close
   */
  closeConnection(connection) {
    if (connection && typeof connection.end === 'function') {
      connection.end();
      this.stats.destroyed++;
    }
  }

  /**
   * Drain the pool (close all connections)
   */
  async drain() {
    const allConnections = [...this.inUseConnections, ...this.availableConnections];
    for (const connection of allConnections) {
      this.closeConnection(connection);
    }
    this.inUseConnections.clear();
    this.availableConnections = [];
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.inUseConnections.size,
      idleConnections: this.availableConnections.length,
      waitingRequests: this.waiting.length,
      utilizationPercentage: ((this.inUseConnections.size / this.maxConnections) * 100).toFixed(2),
    };
  }
}

export default DatabaseConnectionPool;
