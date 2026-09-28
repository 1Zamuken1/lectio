import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service.js';
import { EmailTakenError } from '../../domain/errors.js';
import type { AuthUser } from '../../domain/model.js';
import type { UserRepository } from '../../domain/ports.js';

const SELECT = { id: true, email: true, passwordHash: true, createdAt: true } as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({ where: { email }, select: SELECT });
  }

  findById(id: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SELECT });
  }

  async create(data: { email: string; passwordHash: string }): Promise<AuthUser> {
    try {
      return await this.prisma.user.create({ data, select: SELECT });
    } catch (error) {
      // Dos registros simultáneos con el mismo correo: la restricción única decide.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EmailTakenError();
      }
      throw error;
    }
  }
}
