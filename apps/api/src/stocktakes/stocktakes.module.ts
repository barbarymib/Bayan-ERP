import { Module } from '@nestjs/common';
import { StocktakesController } from './stocktakes.controller.js';
import { StocktakesService } from './stocktakes.service.js';

@Module({
  controllers: [StocktakesController],
  providers: [StocktakesService],
  exports: [StocktakesService],
})
export class StocktakesModule {}