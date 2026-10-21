import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function testSuperAdmin() {
  const baseUrl = 'http://localhost:5001';
  console.log('Testing Super Admin against', baseUrl);

  // 1. Register a test organizer
  const email = `admin_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Super Admin Test Officer',
      email,
      password: 'password123',
    }),
  });

  const regData = await regRes.json();
  if (!regRes.ok) {
    throw new Error(`Register failed: ${JSON.stringify(regData)}`);
  }
  console.log('✓ Registered test organizer:', regData.organizer.name);
  const token = regData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Try accessing super admin overview without passcode
  const noPassRes = await fetch(`${baseUrl}/api/super-admin/overview`, {
    headers: authHeaders,
  });
  console.log('✓ Access without passcode status:', noPassRes.status, '(Expected 403)');
  if (noPassRes.status !== 403) {
    throw new Error('Expected 403 for unverified super admin request');
  }

  // 3. Try verifying with wrong passcode
  const wrongPassRes = await fetch(`${baseUrl}/api/super-admin/verify-passcode`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ passcode: 'WrongPassword123' }),
  });
  console.log('✓ Wrong passcode verification status:', wrongPassRes.status, '(Expected 401)');
  if (wrongPassRes.status !== 401) {
    throw new Error('Expected 401 for wrong passcode');
  }

  // 4. Verify with correct passcode
  const correctPassRes = await fetch(`${baseUrl}/api/super-admin/verify-passcode`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ passcode: 'GateKeeper#SuperAdmin2026!' }),
  });
  const passData = await correctPassRes.json();
  if (!correctPassRes.ok || !passData.token) {
    throw new Error(`Passcode verification failed: ${JSON.stringify(passData)}`);
  }
  console.log('✓ Valid passcode accepted! Super Admin token received.');
  const superAdminToken = passData.token;

  const superAdminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-super-admin-token': superAdminToken,
  };

  // 5. Get platform overview
  const overviewRes = await fetch(`${baseUrl}/api/super-admin/overview`, {
    headers: superAdminHeaders,
  });
  const overview = await overviewRes.json();
  if (!overviewRes.ok) throw new Error(`Overview failed: ${JSON.stringify(overview)}`);
  console.log('✓ Platform Overview metrics:', overview.metrics);

  // 6. Get platform users
  const usersRes = await fetch(`${baseUrl}/api/super-admin/users`, {
    headers: superAdminHeaders,
  });
  const usersData = await usersRes.json();
  console.log(`✓ Retrieved ${usersData.total} users.`);

  // 7. Create event and attendee to test cascade & deletion
  const evtRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Super Admin Test Event',
      date: '2026-11-20',
      startTime: '10:00 AM',
      venue: 'Main Arena',
      capacity: 50,
      prefix: 'SUP',
    }),
  });
  const evtData = await evtRes.json();
  const eventId = evtData.event.id;
  console.log('✓ Created event:', eventId);

  // Publish event so attendee can register
  await fetch(`${baseUrl}/api/events/${eventId}/publish`, {
    method: 'POST',
    headers: authHeaders,
  });

  // Register attendee
  const attRes = await fetch(`${baseUrl}/api/attendees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId,
      name: 'John Attendee',
      email: `john_${Date.now()}@example.com`,
    }),
  });
  const attData = await attRes.json();
  const attendeeId = attData.attendee.id;
  console.log('✓ Registered attendee:', attendeeId);

  // 8. Super admin check registrations
  const regListRes = await fetch(`${baseUrl}/api/super-admin/registrations`, {
    headers: superAdminHeaders,
  });
  const regListData = await regListRes.json();
  console.log(`✓ Super admin sees ${regListData.total} registrations.`);

  // 9. Super admin delete attendee registration
  const delAttRes = await fetch(`${baseUrl}/api/super-admin/registrations/${attendeeId}`, {
    method: 'DELETE',
    headers: superAdminHeaders,
  });
  const delAttData = await delAttRes.json();
  console.log('✓ Super admin deleted registration:', delAttData.message);

  // 10. Super admin delete event
  const delEvtRes = await fetch(`${baseUrl}/api/super-admin/events/${eventId}`, {
    method: 'DELETE',
    headers: superAdminHeaders,
  });
  const delEvtData = await delEvtRes.json();
  console.log('✓ Super admin deleted event:', delEvtData.message);

  // 11. Self-delete guardrail test
  const selfDelRes = await fetch(`${baseUrl}/api/super-admin/users/${regData.organizer.id}`, {
    method: 'DELETE',
    headers: superAdminHeaders,
  });
  console.log('✓ Self-delete protection status:', selfDelRes.status, '(Expected 400)');
  if (selfDelRes.status !== 400) {
    throw new Error('Self delete should be blocked by safety guardrail');
  }

  console.log('\n=========================================');
  console.log(' ALL SUPER ADMIN E2E TESTS PASSED SUCCESSFULLY! ');
  console.log('=========================================\n');
}

testSuperAdmin().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
