import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Страница политики конфиденциальности (нужна для публикации Meta приложения)
  const express = app.getHttpAdapter().getInstance();
  express.get('/privacy', (_req: unknown, res: { send: (html: string) => void }) => {
    res.send(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Политика конфиденциальности — Malenia</title></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px"><h1>Политика конфиденциальности</h1><p>Дата вступления в силу: 21 мая 2026 г.</p><p>Malenia — внутренняя система мониторинга маркетинговых показателей авторской школы Жании Аубакировой. Приложение используется исключительно в корпоративных целях.</p><h2>Сбор данных</h2><p>Приложение получает доступ к данным Instagram Business аккаунтов (количество подписчиков, охваты, показы) исключительно для отображения аналитики внутри системы.</p><h2>Использование данных</h2><p>Данные не передаются третьим лицам и используются только внутри организации.</p><h2>Контакт</h2><p>По вопросам: admin@a-school.kz</p></body></html>`);
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.BACKEND_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`Backend ready on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
