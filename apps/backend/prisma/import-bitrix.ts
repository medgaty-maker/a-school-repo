/**
 * Сохраняет Bitrix24 Incoming Webhook URL в БД (зашифровано).
 *
 * Использование:
 *   npx ts-node prisma/import-bitrix.ts <webhook-url>
 *
 * Пример:
 *   npx ts-node prisma/import-bitrix.ts https://yourcompany.bitrix24.ru/rest/1/abc123/
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const webhookUrl = process.argv[2];
if (!webhookUrl) {
  console.error('Usage: npx ts-node prisma/import-bitrix.ts <webhook-url>');
  process.exit(1);
}

if (!webhookUrl.includes('bitrix24')) {
  console.error('URL does not look like a Bitrix24 webhook URL');
  process.exit(1);
}

const encKey = process.env.ENCRYPTION_KEY;
if (!encKey) {
  console.error('ENCRYPTION_KEY is not set in .env');
  process.exit(1);
}

function encrypt(plain: string): string {
  const key = crypto.createHash('sha256').update(encKey!).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

async function main() {
  const prisma = new PrismaClient();
  const normalised = webhookUrl.trim().replace(/\/?$/, '/');
  const webhookUrlEnc = encrypt(normalised);

  const existing = await prisma.bitrixConfig.findFirst();
  if (existing) {
    await prisma.bitrixConfig.update({ where: { id: existing.id }, data: { webhookUrlEnc } });
    console.log('✅ Bitrix24 webhook URL updated');
  } else {
    await prisma.bitrixConfig.create({ data: { webhookUrlEnc } });
    console.log('✅ Bitrix24 webhook URL saved');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
