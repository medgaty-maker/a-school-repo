import { PrismaClient, ProjectPriority, Role, Platform } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// 6 проектов из §4 ТЗ
const PROJECTS: Array<{
  slug: string;
  name: string;
  priority: ProjectPriority;
  description: string;
}> = [
  {
    slug: 'a-school',
    name: 'Авторская школа Жании Аубакировой',
    priority: ProjectPriority.BOTH,
    description: 'Бренд + Продажи. Охват, узнаваемость, лиды на набор, конверсия в зачисление.',
  },
  {
    slug: 'parent-club',
    name: 'Клуб Родителей',
    priority: ProjectPriority.BRAND,
    description: 'Просмотры, удержание, подписки, доверие к школе как экспертам.',
  },
  {
    slug: 'millimone',
    name: 'Millimone',
    priority: ProjectPriority.BRAND,
    description: 'Охват, вовлечённость, рост подписной базы.',
  },
  {
    slug: 'ayaru-show',
    name: 'Ayaru Show',
    priority: ProjectPriority.BRAND,
    description: 'Охват, вовлечённость, репосты.',
  },
  {
    slug: 'teachers',
    name: 'Teachers',
    priority: ProjectPriority.BRAND,
    description: 'Просмотры, лояльность педагогического сообщества.',
  },
  {
    slug: 'miss-mari',
    name: 'Miss Mari',
    priority: ProjectPriority.BRAND,
    description: 'Просмотры, удержание, рост подписки.',
  },
];

async function main() {
  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@a-school.kz';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
  const adminName = process.env.ADMIN_NAME || 'Admin';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: Role.ADMIN,
    },
    update: { name: adminName, role: Role.ADMIN },
  });
  console.log(`✓ Admin user: ${adminEmail}`);

  // Projects + платформы (4 платформы на каждый, status NOT_CONNECTED)
  for (const p of PROJECTS) {
    const project = await prisma.project.upsert({
      where: { slug: p.slug },
      create: p,
      update: { name: p.name, description: p.description, priority: p.priority },
    });

    for (const platform of Object.values(Platform)) {
      await prisma.projectPlatform.upsert({
        where: {
          projectId_platform: { projectId: project.id, platform },
        },
        create: { projectId: project.id, platform },
        update: {},
      });
    }
    console.log(`✓ Project: ${p.slug} (+ 4 platforms)`);
  }

  console.log('\nDone. Login with:', adminEmail, '/', adminPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
