import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Pre-computed Argon2id hash for development demo password: Password123!
const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$xbF2FUDkPJ0AqmUOlATArA$TmBS8VReoSOQK63a9ijbXS07Y1WQS6lZa3lt8naJqXg';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Seed script must not run in production!');
    process.exit(1);
  }

  console.log('Seeding development database...');

  // 1. Create or upsert Demo Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      aiEnabled: true,
      settings: {
        industry: 'B2B SaaS',
        tier: 'Enterprise',
      },
    },
  });
  console.log(`✓ Organization seeded: ${org.name} (${org.id})`);

  // 2. Create demo users with Argon2id passwords
  const usersData = [
    {
      email: 'admin@leadforge.dev',
      name: 'Sayed Baqar Abbas',
      role: 'owner' as const,
    },
    {
      email: 'manager@leadforge.dev',
      name: 'Vikram Malhotra',
      role: 'sales_manager' as const,
    },
    {
      email: 'sales@leadforge.dev',
      name: 'Sarah Connor',
      role: 'salesperson' as const,
    },
  ];

  const createdUsers: Record<string, string> = {};

  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash: DEMO_PASSWORD_HASH,
        emailVerified: true,
        status: 'active',
      },
    });

    createdUsers[u.role] = user.id;

    // Link Membership
    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id,
        },
      },
      update: { role: u.role },
      create: {
        userId: user.id,
        organizationId: org.id,
        role: u.role,
      },
    });
  }
  console.log('✓ Demo users and memberships seeded (Password: Password123!)');

  // 3. Create default sales pipeline and stages
  let pipeline = await prisma.pipeline.findFirst({
    where: { organizationId: org.id, isDefault: true },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        organizationId: org.id,
        name: 'Standard B2B Sales Pipeline',
        isDefault: true,
        stages: {
          create: [
            { name: 'Qualified Opportunity', sortOrder: 1, stageType: 'open' },
            { name: 'Proposal Submitted', sortOrder: 2, stageType: 'open' },
            { name: 'Contract Negotiation', sortOrder: 3, stageType: 'open' },
            { name: 'Closed Won', sortOrder: 4, stageType: 'won' },
            { name: 'Closed Lost', sortOrder: 5, stageType: 'lost' },
          ],
        },
      },
    });
  }
  console.log(`✓ Default sales pipeline seeded: ${pipeline.name}`);

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { sortOrder: 'asc' },
  });

  // 4. Create sample leads with scores and bands
  const leadsData = [
    {
      fullName: 'Vikram Malhotra',
      emailNormalized: 'vikram@apexcloud.io',
      emailRaw: 'vikram@apexcloud.io',
      phoneNormalized: '+919820144552',
      phoneRaw: '+91 98201 44552',
      company: 'Apex Cloud Logistics',
      jobTitle: 'VP of Technology',
      score: 88,
      scoreBand: 'hot' as const,
      status: 'qualified' as const,
      source: 'Website Demo',
      budgetAmount: 1500000,
    },
    {
      fullName: 'Elena Rostova',
      emailNormalized: 'elena@omniglobal.com',
      emailRaw: 'elena@omniglobal.com',
      phoneNormalized: '+14158892011',
      phoneRaw: '+1 415 889 2011',
      company: 'OmniGlobal Retail',
      jobTitle: 'Head of Growth',
      score: 79,
      scoreBand: 'hot' as const,
      status: 'contacted' as const,
      source: 'Inbound Ingest',
      budgetAmount: 2500000,
    },
    {
      fullName: 'Marcus Vance',
      emailNormalized: 'marcus@vancerobotics.com',
      emailRaw: 'marcus@vancerobotics.com',
      phoneNormalized: '+919711032441',
      phoneRaw: '+91 97110 32441',
      company: 'Vance Robotics',
      jobTitle: 'Director of Procurement',
      score: 58,
      scoreBand: 'warm' as const,
      status: 'new' as const,
      source: 'Webinar',
      budgetAmount: 750000,
    },
    {
      fullName: 'Deepak Chopra',
      emailNormalized: 'deepak@zenithbio.in',
      emailRaw: 'deepak@zenithbio.in',
      phoneNormalized: '+919810011223',
      phoneRaw: '+91 98100 11223',
      company: 'Zenith BioTech',
      jobTitle: 'Operations Lead',
      score: 32,
      scoreBand: 'cold' as const,
      status: 'nurturing' as const,
      source: 'Cold List',
      budgetAmount: 300000,
    },
  ];

  for (const ld of leadsData) {
    const existing = await prisma.lead.findFirst({
      where: { organizationId: org.id, emailNormalized: ld.emailNormalized },
    });

    if (!existing) {
      const lead = await prisma.lead.create({
        data: {
          organizationId: org.id,
          fullName: ld.fullName,
          emailRaw: ld.emailRaw,
          emailNormalized: ld.emailNormalized,
          phoneRaw: ld.phoneRaw,
          phoneNormalized: ld.phoneNormalized,
          company: ld.company,
          jobTitle: ld.jobTitle,
          score: ld.score,
          scoreBand: ld.scoreBand,
          status: ld.status,
          source: ld.source,
          budgetAmount: ld.budgetAmount,
          assignedToId: createdUsers['salesperson'] || null,
        },
      });

      // If Hot, also attach a sample deal in pipeline
      if (ld.scoreBand === 'hot' && stages[0]) {
        await prisma.deal.create({
          data: {
            organizationId: org.id,
            leadId: lead.id,
            pipelineId: pipeline.id,
            stageId: stages[0].id,
            title: `${ld.company} - Platform License`,
            value: ld.budgetAmount,
            probability: 60,
            ownerId: createdUsers['salesperson'] || null,
          },
        });
      }
    }
  }
  console.log('✓ Sample leads and opportunities seeded');

  console.log('\n======================================================');
  console.log('DEVELOPMENT SEED COMPLETE!');
  console.log('Login credentials:');
  console.log('  Email:    admin@leadforge.dev (or manager@leadforge.dev, sales@leadforge.dev)');
  console.log('  Password: Password123!');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
