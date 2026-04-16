const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' }); // Make sure we hit the .env

// List of major Delhi/NCR zones
const delhiZones = [
  // Central/Old Delhi
  { zone_name: 'Connaught Place', area_name: 'New Delhi', center_lat: 28.6315, center_lng: 77.2167, surge_multiplier: 1.5, surge_multiplier_admin: 1.0 },
  { zone_name: 'Karol Bagh', area_name: 'Central Delhi', center_lat: 28.6519, center_lng: 77.1888, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Chandni Chowk', area_name: 'Old Delhi', center_lat: 28.6505, center_lng: 77.2303, surge_multiplier: 1.4, surge_multiplier_admin: 1.0 },
  { zone_name: 'Daryaganj', area_name: 'Central Delhi', center_lat: 28.6441, center_lng: 77.2405, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Patel Nagar', area_name: 'Central Delhi', center_lat: 28.6534, center_lng: 77.1689, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },

  // South Delhi
  { zone_name: 'South Extension', area_name: 'South Delhi', center_lat: 28.5684, center_lng: 77.2198, surge_multiplier: 1.4, surge_multiplier_admin: 1.0 },
  { zone_name: 'Saket', area_name: 'South Delhi', center_lat: 28.5244, center_lng: 77.2066, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Hauz Khas', area_name: 'South Delhi', center_lat: 28.5494, center_lng: 77.2001, surge_multiplier: 1.5, surge_multiplier_admin: 1.0 },
  { zone_name: 'Greater Kailash', area_name: 'South Delhi', center_lat: 28.5435, center_lng: 77.2366, surge_multiplier: 1.4, surge_multiplier_admin: 1.0 },
  { zone_name: 'Vasant Kunj', area_name: 'South West Delhi', center_lat: 28.5298, center_lng: 77.1585, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Green Park', area_name: 'South Delhi', center_lat: 28.5589, center_lng: 77.2040, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Defense Colony', area_name: 'South Delhi', center_lat: 28.5746, center_lng: 77.2341, surge_multiplier: 1.4, surge_multiplier_admin: 1.0 },
  { zone_name: 'Lajpat Nagar', area_name: 'South Delhi', center_lat: 28.5677, center_lng: 77.2433, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Kalkaji', area_name: 'South East Delhi', center_lat: 28.5401, center_lng: 77.2562, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'New Friends Colony', area_name: 'South East Delhi', center_lat: 28.5654, center_lng: 77.2690, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Okhla', area_name: 'South East Delhi', center_lat: 28.5222, center_lng: 77.2760, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Mehrauli', area_name: 'South Delhi', center_lat: 28.5190, center_lng: 77.1818, surge_multiplier: 1.1, surge_multiplier_admin: 1.0 },
  { zone_name: 'Chhatarpur', area_name: 'South Delhi', center_lat: 28.4988, center_lng: 77.1834, surge_multiplier: 1.1, surge_multiplier_admin: 1.0 },

  // East Delhi
  { zone_name: 'Laxmi Nagar', area_name: 'East Delhi', center_lat: 28.6293, center_lng: 77.2764, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Mayur Vihar', area_name: 'East Delhi', center_lat: 28.6053, center_lng: 77.2965, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Anand Vihar', area_name: 'East Delhi', center_lat: 28.6501, center_lng: 77.3152, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Shahdara', area_name: 'Shahdara', center_lat: 28.6946, center_lng: 77.2936, surge_multiplier: 1.1, surge_multiplier_admin: 1.0 },

  // West Delhi
  { zone_name: 'Janakpuri', area_name: 'West Delhi', center_lat: 28.6219, center_lng: 77.0878, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Punjabi Bagh', area_name: 'West Delhi', center_lat: 28.6672, center_lng: 77.1354, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Rajouri Garden', area_name: 'West Delhi', center_lat: 28.6415, center_lng: 77.1198, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Paschim Vihar', area_name: 'West Delhi', center_lat: 28.6687, center_lng: 77.0927, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Kirti Nagar', area_name: 'West Delhi', center_lat: 28.6433, center_lng: 77.1423, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },

  // North / North-West Delhi
  { zone_name: 'Rohini', area_name: 'North West Delhi', center_lat: 28.7297, center_lng: 77.1080, surge_multiplier: 1.1, surge_multiplier_admin: 1.0 },
  { zone_name: 'Pitampura', area_name: 'North West Delhi', center_lat: 28.6983, center_lng: 77.1384, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Model Town', area_name: 'North Delhi', center_lat: 28.7183, center_lng: 77.1901, surge_multiplier: 1.3, surge_multiplier_admin: 1.0 },
  { zone_name: 'Civil Lines', area_name: 'North Delhi', center_lat: 28.6814, center_lng: 77.2227, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Mukherjee Nagar', area_name: 'North Delhi', center_lat: 28.7112, center_lng: 77.2033, surge_multiplier: 1.1, surge_multiplier_admin: 1.0 },

  // Outer/NCR 
  { zone_name: 'Dwarka Sector 21', area_name: 'New Delhi', center_lat: 28.5523, center_lng: 77.0583, surge_multiplier: 1.2, surge_multiplier_admin: 1.0 },
  { zone_name: 'Najafgarh', area_name: 'South West Delhi', center_lat: 28.6090, center_lng: 76.9855, surge_multiplier: 1.1, surge_multiplier_admin: 1.0 },
  { zone_name: 'Noida Sector 18', area_name: 'Noida', center_lat: 28.5701, center_lng: 77.3204, surge_multiplier: 1.4, surge_multiplier_admin: 1.0 },
  { zone_name: 'Cyber City', area_name: 'Gurugram', center_lat: 28.4901, center_lng: 77.0866, surge_multiplier: 1.8, surge_multiplier_admin: 1.0 }
];

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Avi@2006',
    database: process.env.DB_NAME || 'cityflow_db'
  });

  try {
    console.log('Clearing existing zones...');
    
    // Disable foreign key checks to truncate
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    // Instead of truncate, let's just delete or insert ignore. 
    // Truncating might break foreign keys on driver_profiles.current_zone_id if not nullable, 
    // but the original code had 4 zones.
    // Let's just insert them, we can rely on IGNORE or duplicates. Wait, zone_name is unique?
    // Let's delete all zones (might fail if foreign keys exist) 
    await connection.query('DELETE FROM zones');
    await connection.query('ALTER TABLE zones AUTO_INCREMENT = 1');

    console.log('Inserting Delhi/NCR zones...');
    const query = `
      INSERT INTO zones (zone_name, area_name, center_lat, center_lng, surge_multiplier, surge_multiplier_admin)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const z of delhiZones) {
      await connection.query(query, [
        z.zone_name, z.area_name, z.center_lat, z.center_lng, z.surge_multiplier, z.surge_multiplier_admin
      ]);
    }

    console.log(`Successfully seeded ${delhiZones.length} zones!`);
  } catch (err) {
    console.error('Error seeding zones:', err);
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.end();
  }
}

seed();
