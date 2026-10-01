import { PrismaClient } from '@prisma/client';

const prismaGlobal = globalThis as typeof globalThis & { quizSeplagPrisma?: PrismaClient };
export const prisma = prismaGlobal.quizSeplagPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') prismaGlobal.quizSeplagPrisma = prisma;
