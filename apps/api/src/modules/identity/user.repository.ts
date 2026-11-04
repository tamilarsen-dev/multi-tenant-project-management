import { prisma } from "../../config/prisma.js";

type UserDbClient = Pick<typeof prisma, "user">;

export const userRepository = {
  findById(id: string, db: UserDbClient = prisma) {
    return db.user.findUnique({
      where: { id },
    });
  },

  findByEmail(email: string, db: UserDbClient = prisma) {
    return db.user.findUnique({
      where: { email },
    });
  },

  create(
    data: {
      email: string;
      passwordHash: string;
      displayName: string;
    },
    db: UserDbClient = prisma,
  ) {
    return db.user.create({
      data,
    });
  },
};
