import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1d') as unknown as JwtSignOptions['expiresIn'];

const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret.length < 16)) {
  throw new Error('JWT_SECRET must be set to a strong value (>=16 chars) in production');
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret ?? 'dev-only-secret-change-me',
      signOptions: { expiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
