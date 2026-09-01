import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { getPrisma } from '../lib/db';
import { COMMUNITY_ORGANIZATION_ID } from '../lib/tenancy';

async function main() {
  const prisma = getPrisma();
  const email = required('COMMUNITY_BOOTSTRAP_EMAIL').trim().toLowerCase();
  const name = required('COMMUNITY_BOOTSTRAP_NAME').trim();
  const password = required('COMMUNITY_BOOTSTRAP_PASSWORD');
  const resetPassword = process.argv.includes('--reset-password');

  if (password.length < 12 || password.length > 128) {
    throw new Error('COMMUNITY_BOOTSTRAP_PASSWORD must contain between 12 and 128 characters.');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: COMMUNITY_ORGANIZATION_ID },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error('Run the auth and tenancy migration before bootstrapping access.');
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing && !resetPassword) {
    await prisma.member.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: existing.id,
        },
      },
      create: {
        id: randomUUID(),
        organizationId: organization.id,
        userId: existing.id,
        role: 'operator',
        status: 'active',
      },
      update: { status: 'active' },
    });
    console.log(`Access already exists for ${email}. The password was not changed.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = existing?.id || randomUUID();

  await prisma.$transaction(async (tx) => {
    if (!existing) {
      await tx.user.create({
        data: {
          id: userId,
          name,
          email,
          emailVerified: true,
          status: 'active',
          mustChangePassword: true,
        },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: 'credential',
          userId,
          password: passwordHash,
        },
      });
    } else {
      await tx.account.update({
        where: {
          providerId_accountId: {
            providerId: 'credential',
            accountId: userId,
          },
        },
        data: { password: passwordHash },
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: { status: 'active', mustChangePassword: true },
      });
    }

    await tx.member.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId,
        },
      },
      create: {
        id: randomUUID(),
        organizationId: organization.id,
        userId,
        role: 'operator',
        status: 'active',
      },
      update: { role: 'operator', status: 'active' },
    });
  });

  console.log(`Community access is ready for ${email}. Password change is required on first sign-in.`);
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
