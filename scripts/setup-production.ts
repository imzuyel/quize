/**
 * One-time production bootstrap.
 *
 *   npx tsx scripts/setup-production.ts admin@school.edu.bd "YourStrongPassword"
 *
 * Creates the academic structure, official themes, achievements and a single
 * super-admin account. No demo students, quizzes or results are inserted.
 */
import "dotenv/config";
import { bootstrapProduction } from "../src/lib/seed";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("\nব্যবহার: npx tsx scripts/setup-production.ts <admin-email> <password>\n");
  process.exit(1);
}
if (password.length < 8) {
  console.error("\n❌ পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।\n");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("\n❌ DATABASE_URL সেট করা নেই (.env ফাইল দেখুন)।\n");
  process.exit(1);
}

async function main() {
  const result = await bootstrapProduction(email, password);
  if (!result.created) {
    console.log("\nℹ️  ডেটাবেসে আগে থেকেই ইউজার আছে — কিছু পরিবর্তন করা হয়নি।\n");
  } else {
    console.log(`\n✅ সেটআপ সম্পন্ন।\n   ইমেইল: ${email}\n   ভূমিকা: super_admin\n`);
    console.log("   এখন DEMO_MODE=false রেখে অ্যাপ চালু করুন এবং /login থেকে প্রবেশ করুন।\n");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ সেটআপ ব্যর্থ:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});
