import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashSync } from 'bcryptjs';

// أداة تدوير بيانات الدخول عند التسليم للعميل (§12): تحدّث كلمة مرور المشرف العام
// أو مستخدم شركة موجود، دون إعادة بذر القاعدة. الاستخدام:
//   GLOBAL_ADMIN_PASSWORD=... npm run db:rotate
//   USER_EMAIL=... USER_PASSWORD=... npm run db:rotate
//   USER_PHONE=... USER_PASSWORD=... npm run db:rotate

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});

function requireStrong(value: string | undefined, name: string): string | null {
  if (!value) return null;
  if (value.length < 8) throw new Error(`${name} must be at least 8 characters`);
  return value;
}

async function main() {
  let changed = 0;

  const globalPw = requireStrong(process.env.GLOBAL_ADMIN_PASSWORD, 'GLOBAL_ADMIN_PASSWORD');
  if (globalPw) {
    const admin = await prisma.globalAdmin.findUnique({ where: { username: process.env.GLOBAL_ADMIN_USERNAME ?? 'root' } });
    if (!admin) throw new Error('Global admin not found');
    await prisma.globalAdmin.update({
      where: { id: admin.id },
      data: { passwordHash: hashSync(globalPw, 10), active: true },
    });
    console.log(`Rotated global admin '${admin.username}'`);
    changed++;
  }

  const userPw = requireStrong(process.env.USER_PASSWORD, 'USER_PASSWORD');
  const userEmail = process.env.USER_EMAIL?.trim().toLowerCase();
  const userPhone = process.env.USER_PHONE?.trim();
  if (userPw && (userEmail || userPhone)) {
    const user = await prisma.user.findFirst({
      where: { OR: [...(userEmail ? [{ email: userEmail }] : []), ...(userPhone ? [{ phone: userPhone }] : [])] },
    });
    if (!user) throw new Error('User not found for the given email/phone');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashSync(userPw, 10) } });
    console.log(`Rotated user '${user.name}' (#${user.id})`);
    changed++;
  }

  if (changed === 0) {
    console.log('Nothing to do. Provide GLOBAL_ADMIN_PASSWORD, or USER_PASSWORD with USER_EMAIL/USER_PHONE.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
