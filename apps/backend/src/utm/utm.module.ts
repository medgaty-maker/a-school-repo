import { Module } from '@nestjs/common';
import { UtmController } from './utm.controller';
import { UtmService } from './utm.service';

@Module({
  controllers: [UtmController],
  providers: [UtmService],
  exports: [UtmService],
})
export class UtmModule {}
