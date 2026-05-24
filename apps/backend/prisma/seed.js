"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
// 6 проектов из §4 ТЗ
const PROJECTS = [
    {
        slug: 'a-school',
        name: 'Авторская школа Жании Аубакировой',
        priority: client_1.ProjectPriority.BOTH,
        description: 'Бренд + Продажи. Охват, узнаваемость, лиды на набор, конверсия в зачисление.',
    },
    {
        slug: 'parent-club',
        name: 'Клуб Родителей',
        priority: client_1.ProjectPriority.BRAND,
        description: 'Просмотры, удержание, подписки, доверие к школе как экспертам.',
    },
    {
        slug: 'millimone',
        name: 'Millimone',
        priority: client_1.ProjectPriority.BRAND,
        description: 'Охват, вовлечённость, рост подписной базы.',
    },
    {
        slug: 'ayaru-show',
        name: 'Ayaru Show',
        priority: client_1.ProjectPriority.BRAND,
        description: 'Охват, вовлечённость, репосты.',
    },
    {
        slug: 'teachers',
        name: 'Teachers',
        priority: client_1.ProjectPriority.BRAND,
        description: 'Просмотры, лояльность педагогического сообщества.',
    },
    {
        slug: 'miss-mari',
        name: 'Miss Mari',
        priority: client_1.ProjectPriority.BRAND,
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
            role: client_1.Role.ADMIN,
        },
        update: { name: adminName, role: client_1.Role.ADMIN },
    });
    console.log(`✓ Admin user: ${adminEmail}`);
    // Projects + платформы (4 платформы на каждый, status NOT_CONNECTED)
    for (const p of PROJECTS) {
        const project = await prisma.project.upsert({
            where: { slug: p.slug },
            create: p,
            update: { name: p.name, description: p.description, priority: p.priority },
        });
        for (const platform of Object.values(client_1.Platform)) {
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
//# sourceMappingURL=seed.js.map