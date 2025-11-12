// Dev-only script: seed-demo-user.js
// Usage (PowerShell):
//   $env:SUPABASE_URL='https://your-project.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
//   node .\scripts\seed-demo-user.js

const email = process.env.DEMO_EMAIL || 'test@turbo.com';
const password = process.env.DEMO_PASSWORD || 'Tapinrush10@';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.');
  console.error('Example (PowerShell):');
  console.error("  $env:SUPABASE_URL='https://your-project.supabase.co'");
  console.error("  $env:SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'");
  process.exit(1);
}

const adminEndpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`;

(async () => {
  try {
    console.log('Seeding demo user', email);
    const body = {
      email,
      password,
      // request the server to mark email as confirmed (if supported)
      // Supabase Admin API may accept email_confirm: true or email_confirmed_at
      email_confirm: true,
    };

    const res = await fetch(adminEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let out;
    try { out = JSON.parse(text); } catch (e) { out = text; }

    if (!res.ok) {
      console.error('Failed to seed demo user. Status:', res.status);
      console.error(out);
      process.exit(2);
    }

    console.log('Seed succeeded. Response:');
    console.log(JSON.stringify(out, null, 2));
    console.log('\nYou can now try logging in with the demo credentials at /login');
  } catch (err) {
    console.error('Error while seeding demo user:', err);
    process.exit(3);
  }
})();
