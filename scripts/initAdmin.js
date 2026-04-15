const bcrypt = require('bcrypt');

const config = require('../src/config');
const prisma = require('../src/prisma');

async function initAdmin() {
  const existing = await prisma.user.findUnique({ where: { username: config.adminUser } });
  if (existing) {
    console.log(`Admin user '${config.adminUser}' already exists.`);
    return;
  }

  const passwordHash = await bcrypt.hash(config.adminPass, 10);
  await prisma.user.create({
    data: {
      username: config.adminUser,
      passwordHash,
    },
  });
  console.log(`Admin user '${config.adminUser}' created.`);
}

initAdmin()
  .catch((err) => {
    console.error('Failed to initialize admin user:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
