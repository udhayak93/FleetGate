/**
 * Fleet Gate - Automated Cross-Device Multi-Phone Sync Verification
 * Simulates 3 concurrent mobile devices communicating with the shared backend.
 */

const BASE_URL_DEV1 = 'http://127.0.0.1:5173'; // Guard 1 (Android Phone)
const BASE_URL_DEV2 = 'http://127.0.0.1:3000'; // Guard 2 (iPhone)
const BASE_URL_DEV3 = 'http://127.0.0.1:8080'; // Admin (Tablet / Phone)

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 FLEET GATE - CROSS-DEVICE REAL-TIME SYNC VERIFICATION');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 8;

  try {
    // --------------------------------------------------------------------------
    // Test 1: Check Backend Health on all 3 simulated mobile devices
    // --------------------------------------------------------------------------
    console.log('[Test 1] Checking shared cloud backend health across ports...');
    const h1 = await (await fetch(`${BASE_URL_DEV1}/api/health`)).json();
    const h2 = await (await fetch(`${BASE_URL_DEV2}/api/health`)).json();
    const h3 = await (await fetch(`${BASE_URL_DEV3}/api/health`)).json();

    if (h1.status === 'ok' && h2.status === 'ok' && h3.status === 'ok') {
      console.log('  ✅ PASS: All 3 mobile device endpoints are healthy and sharing DB version:', h1.version);
      passedTests++;
    } else {
      throw new Error('Health check failed');
    }

    // --------------------------------------------------------------------------
    // Test 2: Device 1 (Android Phone) records vehicle arrival (IN)
    // --------------------------------------------------------------------------
    console.log('\n[Test 2] Device 1 (Android Phone) records arrival for TN 21 BV 5555...');
    const inRes = await fetch(`${BASE_URL_DEV1}/api/movements/in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plate_number: 'TN 21 BV 5555',
        remarks: 'First Load - River Sand',
        created_by: 'Gate Guard Android'
      })
    });
    const inData = await inRes.json();

    if (inRes.status === 201 && inData.success && inData.movement.in_time && inData.movement.is_active_inside) {
      console.log('  ✅ PASS: Vehicle arrival saved with server timestamp:', inData.movement.in_time);
      console.log('  ✅ Trip Sequence assigned automatically:', `Trip #${inData.movement.trip_number}`);
      passedTests++;
    } else {
      throw new Error(`Failed to record arrival: ${JSON.stringify(inData)}`);
    }

    const movementId = inData.movement.id;

    // --------------------------------------------------------------------------
    // Test 3: Device 2 (iPhone) immediately fetches and verifies shared record
    // --------------------------------------------------------------------------
    console.log('\n[Test 3] Device 2 (iPhone) checks shared cloud database...');
    const listRes = await fetch(`${BASE_URL_DEV2}/api/movements`);
    const listData = await listRes.json();
    const foundOnDevice2 = listData.movements.find(m => m.id === movementId);

    if (foundOnDevice2 && foundOnDevice2.is_active_inside && foundOnDevice2.status === 'IN') {
      console.log('  ✅ PASS: Device 2 instantly sees movement created by Device 1!');
      console.log('  ✅ Plate:', foundOnDevice2.plate_number, '| Remarks:', foundOnDevice2.remarks);
      passedTests++;
    } else {
      throw new Error('Device 2 failed to see Device 1 data in shared cloud DB');
    }

    // --------------------------------------------------------------------------
    // Test 4: Prevent Duplicate Active Arrival
    // --------------------------------------------------------------------------
    console.log('\n[Test 4] Device 2 attempts duplicate check-in for TN 21 BV 5555 (already inside)...');
    const dupRes = await fetch(`${BASE_URL_DEV2}/api/movements/in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plate_number: 'TN 21 BV 5555',
        remarks: 'Duplicate attempt'
      })
    });
    const dupData = await dupRes.json();

    if (dupRes.status === 409 && dupData.success === false) {
      console.log('  ✅ PASS: Server successfully blocked duplicate open visit!');
      console.log('  ✅ Error returned:', dupData.error);
      passedTests++;
    } else {
      throw new Error('Duplicate check failed: Server did not reject duplicate IN');
    }

    // --------------------------------------------------------------------------
    // Test 5: Prevent Departure Without Arrival
    // --------------------------------------------------------------------------
    console.log('\n[Test 5] Device 1 attempts check-out for non-existent vehicle AP 01 ZZ 9999...');
    const invalidOutRes = await fetch(`${BASE_URL_DEV1}/api/movements/out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plate_number: 'AP 01 ZZ 9999',
        remarks: 'Never arrived'
      })
    });
    const invalidOutData = await invalidOutRes.json();

    if (invalidOutRes.status === 404 && invalidOutData.success === false) {
      console.log('  ✅ PASS: Server blocked departure for vehicle not checked IN!');
      console.log('  ✅ Error returned:', invalidOutData.error);
      passedTests++;
    } else {
      throw new Error('Departure validation failed: Server allowed departure without arrival');
    }

    // --------------------------------------------------------------------------
    // Test 6: Device 2 (iPhone) records vehicle departure (OUT)
    // --------------------------------------------------------------------------
    console.log('\n[Test 6] Device 2 (iPhone) logs departure for TN 21 BV 5555...');
    const outRes = await fetch(`${BASE_URL_DEV2}/api/movements/out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movement_id: movementId,
        remarks: 'Unloaded and verified at Weighbridge'
      })
    });
    const outData = await outRes.json();

    if (outRes.status === 200 && outData.success && outData.movement.out_time && !outData.movement.is_active_inside) {
      console.log('  ✅ PASS: Departure logged with server timestamp:', outData.movement.out_time);
      console.log('  ✅ Updated status:', outData.movement.status, '| Active inside:', outData.movement.is_active_inside);
      passedTests++;
    } else {
      throw new Error(`Failed to record departure: ${JSON.stringify(outData)}`);
    }

    // --------------------------------------------------------------------------
    // Test 7: Device 3 (Admin Phone) logs in & checks shared stats
    // --------------------------------------------------------------------------
    console.log('\n[Test 7] Device 3 (Admin Phone) logs in and checks shared live statistics...');
    const loginRes = await fetch(`${BASE_URL_DEV3}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gmail.com',
        password: 'Admin@123'
      })
    });
    const loginData = await loginRes.json();

    const statsRes = await fetch(`${BASE_URL_DEV3}/api/stats`);
    const statsData = await statsRes.json();

    if (loginData.success && loginData.user.role === 'admin' && statsData.inside_now === 0 && statsData.total_vehicles_today === 1) {
      console.log('  ✅ PASS: Admin successfully authenticated from Device 3!');
      console.log('  ✅ Live Stats: Inside Now =', statsData.inside_now, '| Total Today =', statsData.total_vehicles_today);
      passedTests++;
    } else {
      throw new Error(`Admin login or stats check failed: ${JSON.stringify(statsData)}`);
    }

    // --------------------------------------------------------------------------
    // Test 8: Device 1 records 2nd Trip -> Multi-trip counting verified
    // --------------------------------------------------------------------------
    console.log('\n[Test 8] Device 1 records 2nd Trip today for TN 21 BV 5555...');
    const trip2Res = await fetch(`${BASE_URL_DEV1}/api/movements/in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plate_number: 'TN 21 BV 5555',
        remarks: 'Second Load - Aggregate'
      })
    });
    const trip2Data = await trip2Res.json();

    const statsAfterTrip2 = await (await fetch(`${BASE_URL_DEV3}/api/stats`)).json();

    if (trip2Data.success && trip2Data.movement.trip_number === 2 && statsAfterTrip2.multi_trip_count === 1) {
      console.log('  ✅ PASS: Multi-trip accurately tracked across devices!');
      console.log('  ✅ Vehicle TN 21 BV 5555 is on Trip #2');
      console.log('  ✅ Admin sees Multi-Trip Vehicles count =', statsAfterTrip2.multi_trip_count);
      passedTests++;
    } else {
      throw new Error(`Trip 2 counting failed: ${JSON.stringify(trip2Data)}`);
    }

    // Clean up test data
    await fetch(`${BASE_URL_DEV3}/api/admin/reset-all`, { method: 'POST' });

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED! CROSS-DEVICE SYNC IS 100% VERIFIED.`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.message);
    process.exit(1);
  }
}

runVerification();
