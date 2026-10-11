import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/auth.decorators.js';

export interface HealthResponse {
  status: string;
  version: string;
  time: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOkResponse({ type: Object })
  check(): HealthResponse {
    return {
      status: 'ok',
      version: process.env.APP_VERSION ?? '0.1.0',
      time: new Date().toISOString(),
    };
  }
}
