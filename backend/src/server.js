require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

// Validate environment secrets are not default values
function validateEnvironment() {
  const DEFAULT_JWT_SECRET = 'dev-secret-key-change-in-production-abc123';
  const DEFAULT_ENCRYPTION_KEY = 'dev-encryption-key-change-in-production';

  const errors = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    errors.push('JWT_SECRET must be changed from default value');
  }

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === DEFAULT_ENCRYPTION_KEY) {
    errors.push('ENCRYPTION_KEY must be changed from default value');
  }

  if (errors.length > 0 && process.env.NODE_ENV === 'production') {
    logger.error('Environment validation failed:', { errors });
    process.exit(1);
  } else if (errors.length > 0) {
    logger.warn('WARNING: Using default secrets. Change before production!', { errors });
  }
}

validateEnvironment();

const PORT = process.env.PORT || 3001;
const ENABLE_CLUSTER = process.env.ENABLE_CLUSTER === 'true';
const NUM_WORKERS = parseInt(process.env.CLUSTER_WORKERS) || os.cpus().length;

const certPath = path.join(__dirname, '..', '..', 'certs', 'server.cert');
const keyPath = path.join(__dirname, '..', '..', 'certs', 'server.key');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  logger.error('SSL certificates not found. Run: npm run generate-cert');
  process.exit(1);
}

const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

if (ENABLE_CLUSTER && cluster.isPrimary) {
  logger.info(`Primary process ${process.pid} starting with ${NUM_WORKERS} workers`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.info(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });
} else {
  // Worker process or single-process mode
  const app = require('./app');
  const { initializeDatabase } = require('./data');

  initializeDatabase();

  https.createServer(sslOptions, app).listen(PORT, () => {
    if (ENABLE_CLUSTER) {
      logger.info(`Worker ${process.pid} listening on port ${PORT}`);
    } else {
      logger.info(`HTTPS server running on port ${PORT} (single process mode)`);
    }
  });
}
