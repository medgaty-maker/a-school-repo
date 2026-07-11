import { Controller, Get } from '@nestjs/common';
import { KabinetyService } from './kabinety.service';

@Controller('integrations/kabinety')
export class KabinetyController {
  constructor(private readonly kabinety: KabinetyService) {}

  // Кол-во детей в школе (2026/2027) из kabinety.aubakirova.school
  @Get('summary')
  summary() {
    return this.kabinety.getSummary();
  }
}
