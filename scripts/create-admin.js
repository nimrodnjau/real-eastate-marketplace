// scripts/create-admin.js
//
// Creates a staff login (auth.users) AND grants dashboard access
// (marketplace.admin_users) in one run.
//
// SECURITY:
//   - Uses the service_role key, which bypasses RLS entirely.
//   - Run this ONLY from your own machine, NEVER from the React app,
//     NEVER commit the service_role key, NEVER expose it to the browser.
//   - Get the key from: Supabase dashboard -> Project Settings -> API -> service_role.
//
// SETUP (one time):
//   npm install @supabase/supabase-js dotenv
//   Create a .env file (add it to .gitignore) with:
//     SUPABASE_URL=https://your-project.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
//
// USAGE:
//   node scripts/create-admin.js "person@example.com" "TempPassw0rd!" "Full Name" "ops"
//   (role must be one of: super_admin, ops, verifier, finance)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [, , email, password, fullName, role = 'ops'] = process.argv;

const VALID_ROLES = ['super_admin', 'ops', 'verifier', 'finance'];

async function main() {
  if (!email || !password || !fullName) {
    console.error(
      'Usage: node scripts/create-admin.js <email> <password> "<full name>" <role>'
    );
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`Role must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log(`Creating auth account for ${email}...`);
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the confirmation email step
  });

  if (userError) {
    console.error('Failed to create auth user:', userError.message);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log(`Auth account created. UUID: ${userId}`);

  console.log(`Granting ${role} access in admin_users...`);
  const { error: adminError } = await supabaseAdmin
    .schema('marketplace')
    .from('admin_users')
    .insert({ id: userId, full_name: fullName, role });

  if (adminError) {
    console.error('Auth account was created, but admin_users insert failed:', adminError.message);
    console.error(`You can retry manually with this UUID: ${userId}`);
    process.exit(1);
  }

  console.log('Done. This account can now sign in at /admin/login.');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('  (Tell them to change it after first login.)');
}

main();