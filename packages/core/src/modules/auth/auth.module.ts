import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AuthService } from './application/auth.service.js';
import {
  ACCESS_TOKEN_ISSUER,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from './domain/ports.js';
import { AuthController } from './infrastructure/http/auth.controller.js';
import { JwtAuthGuard } from './infrastructure/http/jwt-auth.guard.js';
import { UsersController } from './infrastructure/http/users.controller.js';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository.js';
import { Argon2Hasher } from './infrastructure/security/argon2.hasher.js';
import { JwtIssuer } from './infrastructure/security/jwt.issuer.js';

/**
 * Autenticación (docs/lectio-arquitectura-api.md §1.9 y §2.1). Los puertos se enlazan con
 * sus adaptadores aquí: el caso de uso no sabe de argon2, JWT ni Prisma.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_SECRET,
        signOptions: { algorithm: 'HS256', issuer: 'lectio' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'lectio' },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2Hasher },
    { provide: ACCESS_TOKEN_ISSUER, useClass: JwtIssuer },
  ],
  exports: [AuthService, JwtAuthGuard, ACCESS_TOKEN_ISSUER],
})
export class AuthModule {}
