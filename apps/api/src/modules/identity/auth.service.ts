import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/http/app-error.js";
import { userRepository } from "./user.repository.js";
import { sessionRepository } from "./session.repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateSessionToken, hashSessionToken } from "./session-token.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const authService = {
  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();

    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      throw new AppError("CONFLICT", {
        message: "Email is already registered",
      });
    }

    const passwordHash = await hashPassword(input.password);

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    try {
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await userRepository.create(
          {
            email,
            passwordHash,
            displayName: input.displayName,
          },
          tx,
        );

        await sessionRepository.create(
          {
            userId: newUser.id,
            tokenHash,
            expiresAt,
          },
          tx,
        );

        return newUser;
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt,
        },
        sessionToken,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("CONFLICT", {
          message: "Email is already registered",
        });
      }

      throw error;
    }
  },

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();

    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new AppError("UNAUTHENTICATED", {
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new AppError("UNAUTHENTICATED", {
        message: "Invalid email or password",
      });
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await sessionRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      sessionToken,
    };
  },

  async logout(sessionId: string) {
    await sessionRepository.revokeById(sessionId);
  },
};
