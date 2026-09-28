import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service.js';
import type { NewRefreshToken, StoredRefreshToken } from '../../domain/model.js';
import type { RefreshTokenRepository } from '../../domain/ports.js';

const SELECT = {
  id: true,
  userId: true,
  familyId: true,
  expiresAt: true,
  revokedAt: true,
  replacedBy: true,
} as const;

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewRefreshToken): Promise<StoredRefreshToken> {
    return this.prisma.refreshToken.create({ data, select: SELECT });
  }

  findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash }, select: SELECT });
  }

  rotate(oldId: string, next: NewRefreshToken): Promise<StoredRefreshToken | null> {
    return this.prisma.$transaction(async (tx) => {
      // Revoca el anterior solo si seguía vigente: entre dos rotaciones simultáneas, gana una.
      const now = new Date();
      const { count } = await tx.refreshToken.updateMany({
        where: { id: oldId, revokedAt: null },
        data: { revokedAt: now },
      });
      if (count === 0) return null;
      const created = await tx.refreshToken.create({ data: next, select: SELECT });
      await tx.refreshToken.update({ where: { id: oldId }, data: { replacedBy: created.id } });
      return created;
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
