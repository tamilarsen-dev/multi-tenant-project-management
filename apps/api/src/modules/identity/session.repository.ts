import { prisma } from "../../config/prisma.js";

type SessionDbClient = Pick<typeof prisma, "session">;

export const sessionRepository = {
  create(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    db: SessionDbClient = prisma,
  ) {
    return db.session.create({
      data,
    });
  },

  findByTokenHash(tokenHash: string, db: SessionDbClient = prisma) {
    return db.session.findUnique({
      where: { tokenHash },
    });
  },

  revokeById(id: string, db: SessionDbClient = prisma) {
    return db.session.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  findActiveByTokenHash(tokenHash: string, db: SessionDbClient = prisma) {
    return db.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
  },
};
