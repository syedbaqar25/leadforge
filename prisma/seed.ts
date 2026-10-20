import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Seed script must not run in production!');
    process.exit(1);
  }

  console.log('Seeding database...');

  // Phase 1 Placeholder:
  // Detailed seeds will be populated in Phase 2 when authentication & password hashing utilities are implemented.
  // - Create demo organization (e.g. Acme Corp / acme-demo)
  // - Create demo users with hashed passwords (Owner, Admin, Sales Rep)
  // - Create sample leads, custom fields, default pipeline, stages, and deals
  // - All clearly labeled as development sample data

  console.log('Seed complete. This is DEVELOPMENT DATA ONLY.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
