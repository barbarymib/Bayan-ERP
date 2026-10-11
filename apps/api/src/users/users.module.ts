import { Module } from '@nestjs/common';
import { PermissionsController, RolesController, UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController, RolesController, PermissionsController],
  providers: [UsersService],
})
export class UsersModule {}