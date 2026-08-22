import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  TelegramUserProfile,
  TelegramUsersService,
} from './application/telegram-users.service';

const telegramIdentifierSchema = z
  .union([z.string(), z.number().int().safe()])
  .transform((value) => String(value))
  .pipe(z.string().regex(/^-?\d+$/u));

const createUserSchema = z
  .object({
    telegramUserId: telegramIdentifierSchema,
    privateChatId: telegramIdentifierSchema.optional(),
    firstName: z.string().trim().min(1).max(128).optional(),
    lastName: z.string().trim().min(1).max(128).optional(),
    role: z.enum(['MEMBER', 'MODERATOR', 'ADMIN']).optional(),
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{5,32}$/u)
      .optional(),
  })
  .strict();

@Controller('api/users')
export class UsersController {
  constructor(
    private readonly configService: ConfigService,
    private readonly telegramUsersService: TelegramUsersService,
  ) {}

  @Get('/:telegramUserId')
  @HttpCode(HttpStatus.OK)
  async getUserById(
    @Param('telegramUserId') telegramUserId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-admin-api-token') legacyToken?: string,
  ) {
    this.assertAdminToken(this.getProvidedToken(authorization, legacyToken));
    return this.telegramUsersService.findByTelegramUserId(telegramUserId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUsers(
    @Param('telegramUserId') telegramUserId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-admin-api-token') legacyToken?: string,
  ) {
    this.assertAdminToken(this.getProvidedToken(authorization, legacyToken));
    return this.telegramUsersService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrActivate(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
    @Headers('x-admin-api-token') legacyToken?: string,
  ) {
    this.assertAdminToken(this.getProvidedToken(authorization, legacyToken));
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('Invalid user payload.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.telegramUsersService.createOrActivate(
      parsed.data satisfies TelegramUserProfile,
    );
  }

  @Patch('/:telegramUserId')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('telegramUserId') telegramUserId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
    @Headers('x-admin-api-token') legacyToken?: string,
  ) {
    this.assertAdminToken(this.getProvidedToken(authorization, legacyToken));

    if (typeof body !== 'object' || body === null) {
      throw new BadRequestException('Invalid user payload.');
    }
    return this.telegramUsersService.update(telegramUserId, body);
  }

  @Delete('/:telegramUserId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('telegramUserId') telegramUserId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-admin-api-token') legacyToken?: string,
  ) {
    this.assertAdminToken(this.getProvidedToken(authorization, legacyToken));

    if (!telegramUserId) {
      throw new BadRequestException('Invalid user telegram id');
    }

    return await this.telegramUsersService.delete(telegramUserId);
  }

  private getProvidedToken(
    authorization: string | undefined,
    legacyToken: string | undefined,
  ): string | undefined {
    if (authorization?.startsWith('Bearer ') === true) {
      return authorization.slice('Bearer '.length);
    }

    return legacyToken;
  }

  private assertAdminToken(providedToken: string | undefined): void {
    const expectedToken = this.configService.get<string>('ADMIN_API_TOKEN');

    if (expectedToken === undefined) {
      throw new ServiceUnavailableException('Admin API is not configured.');
    }

    if (providedToken === undefined) {
      throw new UnauthorizedException('Missing admin API token.');
    }

    const expected = Buffer.from(expectedToken);
    const provided = Buffer.from(providedToken);

    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw new UnauthorizedException('Invalid admin API token.');
    }
  }
}
