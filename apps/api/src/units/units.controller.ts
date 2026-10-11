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
import { Permissions } from '../auth/auth.decorators.js';
import { CreateUnitDto, QueryUnitsDto, UpdateUnitDto } from './units.dto.js';
import { UnitsService } from './units.service.js';

@ApiTags('units')
@ApiBearerAuth()
@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة وحدات القياس' })
  list(@Query() query: QueryUnitsDto) {
    return this.units.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل وحدة قياس' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.units.findOne(id);
  }

  @Post()
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'إنشاء وحدة قياس' })
  create(@Body() dto: CreateUnitDto) {
    return this.units.create(dto);
  }

  @Patch(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'تعديل وحدة قياس' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUnitDto) {
    return this.units.update(id, dto);
  }

  @Delete(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'حذف وحدة قياس (غير مستخدمة)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.units.remove(id);
  }
}