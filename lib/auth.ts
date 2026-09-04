import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/db';
import { COMMUNITY_ORGANIZATION_ID } from '@/lib/tenancy';

const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
const configuredOrigins = (process.env.AUTH_TRUSTED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: 'OpenFireDetection',
  ...(baseURL ? { baseURL } : {}),
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      status: {
        type: 'string',
        required: true,
        defaultValue: 'active',
        input: false,
      },
      mustChangePassword: {
        type: 'boolean',
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    freshAge: 60 * 15,
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const membership = await prisma.member.findFirst({
            where: {
              userId: session.userId,
              organizationId: COMMUNITY_ORGANIZATION_ID,
              status: 'active',
              organization: { status: 'active' },
            },
            select: { organizationId: true },
          });

          if (!membership) return false;

          return {
            data: session,
          };
        },
      },
    },
  },
  trustedOrigins: configuredOrigins,
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': {
        window: 60,
        max: 5,
      },
      '/change-password': {
        window: 60,
        max: 5,
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
});

export type AuthSession = typeof auth.$Infer.Session;
