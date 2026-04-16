const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'change_me_jwt_secret',
  encryptionKey: process.env.ENCRYPTION_KEY || 'change_me_32_characters_minimum_key',
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'admin',
  databaseUrl: process.env.DATABASE_URL || `file:${path.join(dataDir, 'app.db')}`,
};

process.env.DATABASE_URL = config.databaseUrl;

module.exports = config;
