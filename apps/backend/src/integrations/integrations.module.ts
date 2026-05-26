import { Module } from '@nestjs/common';
import { YoutubeService } from './youtube/youtube.service';
import { YoutubeController } from './youtube/youtube.controller';
import { MetaService } from './meta/meta.service';
import { MetaController } from './meta/meta.controller';
import { BitrixService } from './bitrix/bitrix.service';
import { BitrixController } from './bitrix/bitrix.controller';
import { CryptoService } from './crypto.service';
import { YandexMetricaService } from './yandex-metrica/yandex-metrica.service';
import { YandexMetricaController } from './yandex-metrica/yandex-metrica.controller';
import { TikTokService } from './tiktok/tiktok.service';
import { TikTokController } from './tiktok/tiktok.controller';

@Module({
  controllers: [YoutubeController, MetaController, BitrixController, YandexMetricaController, TikTokController],
  providers: [YoutubeService, MetaService, BitrixService, CryptoService, YandexMetricaService, TikTokService],
  exports: [YoutubeService, MetaService, BitrixService, CryptoService, YandexMetricaService, TikTokService],
})
export class IntegrationsModule {}
