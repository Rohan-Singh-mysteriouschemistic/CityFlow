const BASE_URL = 'http://localhost:5000/api';

async function simulate() {
  try {
    console.log('--- STARTING RIDE SIMULATION ---');

    // 1. LOGIN RIDER
    console.log('\n[1] Logging in as Rider (Rohan)...');
    const riderLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan@cityflow.in', password: 'test1234' })
    });
    const riderLogin = await riderLoginRes.json();
    if (!riderLoginRes.ok) throw new Error(`Rider Login Failed: ${JSON.stringify(riderLogin)}`);
    const riderToken = riderLogin.token;
    console.log('Rider logged in. ID:', riderLogin.user.user_id);

    // 2. LOGIN DRIVER
    console.log('\n[2] Logging in as Driver (Ramesh)...');
    const driverLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ramesh@cityflow.in', password: 'test1234' })
    });
    const driverLogin = await driverLoginRes.json();
    if (!driverLoginRes.ok) throw new Error(`Driver Login Failed: ${JSON.stringify(driverLogin)}`);
    const driverToken = driverLogin.token;
    console.log('Driver logged in. ID:', driverLogin.user.user_id);

    // 3. RIDER REQUESTS RIDE
    console.log('\n[3] Rider requesting ride...');
    const requestData = {
      pickup_address: 'Cyber City, Gurugram',
      pickup_lat: 28.4901,
      pickup_lng: 77.0866,
      drop_address: 'Connaught Place',
      drop_lat: 28.6328,
      drop_lng: 77.2197,
      vehicle_type: 'sedan',
      estimated_km: 15.5,
      payment_method: 'cash'
    };
    const rideRequestRes = await fetch(`${BASE_URL}/rides/request`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${riderToken}`
      },
      body: JSON.stringify(requestData)
    });
    const rideRequest = await rideRequestRes.json();
    if (!rideRequestRes.ok) throw new Error(`Ride Request Failed: ${JSON.stringify(rideRequest)}`);
    const requestId = rideRequest.request_id;
    console.log('Ride requested. Request ID:', requestId);

    // 4. DRIVER ACCEPTS RIDE
    console.log('\n[4] Driver accepting ride...');
    const acceptRideRes = await fetch(`${BASE_URL}/rides/accept/${requestId}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      }
    });
    const acceptRide = await acceptRideRes.json();
    if (!acceptRideRes.ok) throw new Error(`Accept Ride Failed: ${JSON.stringify(acceptRide)}`);
    const rideId = acceptRide.ride_id;
    const otp = acceptRide.otp;
    console.log('Ride accepted! Ride ID:', rideId, 'OTP:', otp);

    // 5. DRIVER STARTS RIDE
    console.log('\n[5] Driver starting ride with OTP...');
    const startRideRes = await fetch(`${BASE_URL}/rides/${rideId}/start`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({ otp })
    });
    const startRide = await startRideRes.json();
    if (!startRideRes.ok) throw new Error(`Start Ride Failed: ${JSON.stringify(startRide)}`);
    console.log('Ride started:', startRide.message);

    // 6. DRIVER COMPLETES RIDE (wait 2s to satisfy end_time > start_time)
    console.log('\n[6] Waiting 2s before completing ride...');
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('[7] Driver completing ride...');
    const completeRideRes = await fetch(`${BASE_URL}/rides/${rideId}/complete`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({ actual_km: 16.2 })
    });
    const completeRide = await completeRideRes.json();
    if (!completeRideRes.ok) throw new Error(`Complete Ride Failed: ${JSON.stringify(completeRide)}`);
    console.log('Ride completed:', completeRide.message);
    console.log('Total Amount:', completeRide.total_amount);

    console.log('\n--- SIMULATION SUCCESSFUL ---');
  } catch (err) {
    console.error('\n--- SIMULATION FAILED ---');
    console.error(err.message);
    process.exit(1);
  }
}

simulate();
