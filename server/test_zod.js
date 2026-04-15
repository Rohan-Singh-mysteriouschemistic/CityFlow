const { requestRideSchema } = require('./validators/rideValidators');

const payload = {
  pickup_address: 'A',
  pickup_lat: 28.6139,
  pickup_lng: 77.2090,
  drop_address: 'B',
  drop_lat: 28.5355,
  drop_lng: 77.3910,
  zone_id: '1',
  vehicle_type: 'sedan',
  estimated_km: '15',
  payment_method: 'cash'
};

const result = requestRideSchema.safeParse(payload);
if (!result.success) {
  console.log('Errors:', result.error.issues);
} else {
  console.log('Parsed:', result.data);
}
