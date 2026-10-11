import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import {
  CreateSpecialPriceDto,
  QuerySpecialPricesDto,
  UpdateSpecialPriceDto,
} from './special-prices.dto.js';
import { SpecialPricesService } from './special-prices.service.js';

@ApiTags('special-prices')
@ApiBearerAuth()
@Controller('special-prices')
export class SpecialPricesController {
  constructor(private readonly specials: SpecialPricesService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة الأسعار الخاصة (§5.16)' })
  list(@Query() query: QuerySpecialPricesDto, @CurrentUser() user: AuthUser) {
    return this.specials.listSpecial(query, user.companyId ?? null);
  }

  @Post()
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'إنشاء سعر خاص' })
  create(@Body() dto: CreateSpecialPriceDto, @CurrentUser() user: AuthUser) {
    return this.specials.createSpecial(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'تعديل سعر خاص' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSpecialPriceDto, @CurrentUser() user: AuthUser) {
    return this.specials.updateSpecial(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'حذف سعر خاص' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.specials.removeSpecial(id, user.companyId ?? null);
  }
}
