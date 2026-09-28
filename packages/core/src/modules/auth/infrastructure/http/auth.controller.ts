import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { APP_CONFIG } from '../../../../config/config.module.js';
import type { AppConfig } from '../../../../config/env.js';
import { AuthService } from '../../application/auth.service.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  userAgentOf,
  type CookieRequest,
  type CookieResponse,
} from './cookies.js';
import { Public } from './decorators.js';
import { AccessTokenDto, CredentialsDto, LoginResponseDto, UserDto } from './dto.js';

/** Contra fuerza bruta: 5 intentos por minuto y por IP en registro y login (arquitectura §1.8). */
const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Crea una cuenta' })
  @ApiCreatedResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'EMAIL_TAKEN: ya existe una cuenta con ese correo.' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos desde esta IP.' })
  register(@Body() body: CredentialsDto): Promise<UserDto> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Inicia sesión',
    description: 'Devuelve el access token y deja el refresh token en una cookie httpOnly.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'INVALID_CREDENTIALS' })
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos desde esta IP.' })
  async login(
    @Body() body: CredentialsDto,
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<LoginResponseDto> {
    const session = await this.auth.login({ ...body, userAgent: userAgentOf(request) });
    setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
      this.config.COOKIE_SECURE,
    );
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Renueva la sesión',
    description:
      'Usa la cookie del refresh token (sin cuerpo), la rota y entrega un access token nuevo.',
  })
  @ApiOkResponse({ type: AccessTokenDto })
  @ApiUnauthorizedResponse({ description: 'INVALID_REFRESH_TOKEN o REFRESH_TOKEN_REUSED' })
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AccessTokenDto> {
    try {
      const session = await this.auth.refresh(readRefreshCookie(request), userAgentOf(request));
      setRefreshCookie(
        response,
        session.refreshToken,
        session.refreshExpiresAt,
        this.config.COOKIE_SECURE,
      );
      return { accessToken: session.accessToken, expiresIn: session.expiresIn };
    } catch (error) {
      clearRefreshCookie(response, this.config.COOKIE_SECURE); // una cookie inútil no se reenvía
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cierra la sesión actual' })
  @ApiNoContentResponse({ description: 'Sesión cerrada (también si ya lo estaba).' })
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request));
    clearRefreshCookie(response, this.config.COOKIE_SECURE);
  }
}
