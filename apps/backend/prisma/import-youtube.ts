/**
 * Импорт готовой YouTube-привязки (refresh_token + channel_id) из .env в БД.
 *
 * Используется для миграции токенов из старого прототипа без повторного OAuth.
 * Запуск: npx ts-node prisma/import-youtube.ts <project-slug>
 *
 * Ожидает в .env переменные с суффиксом _FOR_<UPPER_SLUG_WITHOUT_DASHES>:
 *   YOUTUBE_CHANNEL_ID_FOR_<SLUG>      (обязательно)
 *   YOUTUBE_REFRESH_TOKEN_FOR_<SLUG>   (обязательно)
 *   YOUTUBE_CLIENT_ID_FOR_<SLUG>       (опционально — для per-platform OAuth client)
 *   YOUTUBE_CLIENT_SECRET_FOR_<SLUG>   (опционально)
 *
 * Если CLIENT_ID/SECRET не заданы — будут использованы глобальные YOUTUBE_CLIENT_ID/SECRET.
 */
import 'dotenv/config';
import * as crypto from 'crypto';
import { PrismaClient, IntegrationStatus, Platform } from '@prisma/client';

const ALGO = 'aes-256-gcm';

function encrypt(plain: string, keyRaw: string): string {
  const key = crypto.createHash('sha256').update(keyRaw).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: ts-node prisma/import-youtube.ts <project-slug>');
    process.exit(1);
  }

  const upper = slug.replace(/-/g, '').toUpperCase();
  const channelId = process.env[`YOUTUBE_CHANNEL_ID_FOR_${upper}`];
  const refreshToken = process.env[`YOUTUBE_REFRESH_TOKEN_FOR_${upper}`];
  const clientId = process.env[`YOUTUBE_CLIENT_ID_FOR_${upper}`];
  const clientSecret = process.env[`YOUTUBE_CLIENT_SECRET_FOR_${upper}`];
  const encKey = process.env.ENCRYPTION_KEY;

  if (!channelId || !refreshToken) {
    console.error(
      `Missing env: YOUTUBE_CHANNEL_ID_FOR_${upper} / YOUTUBE_REFRESH_TOKEN_FOR_${upper}`,
    );
    process.exit(1);
  }
  if (!encKey) {
    console.error('Missing ENCRYPTION_KEY');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) {
      console.error(`Project ${slug} not found. Run npm run db:seed first.`);
      process.exit(1);
    }

    // Получим название канала для UI
    const apiKey = process.env.YOUTUBE_API_KEY;
    let channelTitle: string | null = null;
    if (apiKey) {
      try {
        const r = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`,
        );
        const j: any = await r.json();
        channelTitle = j.items?.[0]?.snippet?.title ?? null;
      } catch (e) {
        console.warn('Could not fetch channel title:', (e as Error).message);
      }
    }

    const updated = await prisma.projectPlatform.update({
      where: {
        projectId_platform: { projectId: project.id, platform: Platform.YOUTUBE },
      },
      data: {
        externalAccountId: channelId,
        externalAccountName: channelTitle,
        refreshTokenEnc: encrypt(refreshToken, encKey),
        oauthClientIdEnc: clientId ? encrypt(clientId, encKey) : null,
        oauthClientSecretEnc: clientSecret ? encrypt(clientSecret, encKey) : null,
        status: IntegrationStatus.ACTIVE,
        lastError: null,
      },
    });

    console.log(`✓ ${slug}: YouTube linked`);
    console.log(`  channelId: ${channelId}`);
    console.log(`  channelTitle: ${channelTitle ?? '(unknown — set YOUTUBE_API_KEY)'}`);
    console.log(`  perPlatformOAuth: ${clientId ? 'yes' : 'no (will use global YOUTUBE_CLIENT_ID/SECRET)'}`);
    console.log(`  projectPlatformId: ${updated.id}`);
    console.log(`\nNow run: curl -X POST http://localhost:4000/api/snapshots/run -H "Authorization: Bearer <token>"`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
