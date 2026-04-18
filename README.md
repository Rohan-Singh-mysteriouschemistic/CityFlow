# CityFlow

## 1. Project Title & Description
**CityFlow** is an advanced urban mobility and ride-sharing platform designed to seamlessly connect riders and drivers. 
It solves the complex problem of efficient ride assignments, surge pricing, and concurrent database operations in high-traffic logistics environments. Built for scale, it handles robust database concurrency and seamless map integration to deliver a premium user experience.

## 2. Features
- **Real-Time Ride Matching:** Automatically assigns riders to nearby drivers.
- **Dynamic Pricing & Surge:** Handles dynamic zone-based surge multipliers safely under high loads.
- **Interactive Maps:** Real-time location tracking using Mapbox.
- **Robust Concurrency Control:** Implements advanced ACID properties, transactions, and `SELECT FOR UPDATE` to prevent race conditions during ride assignments.
- **User Personas:** Interactive dashboards and roles for Riders, Drivers, and Admins.

## 3. Tech Stack
- **Frontend:** React.js, Vite, Mapbox-GL for maps, Lucide React (Icons).
- **Backend:** Node.js, Express.js (v5), Zod for validation, JSON Web Tokens (JWT).
- **Database:** MySQL (mysql2) — utilizing complex queries, views, triggers, and transactions for maximum data integrity.

## 4. Setup / Installation
Follow these steps to get the project running locally:

```bash
# Clone the repository
git clone <repo>

# Go into the project directory
cd CityFlow
```

### Server Setup
```bash
cd server
npm install
```

### Client Setup
```bash
cd ../client
npm install
```

### Environment Variables
You will need to configure `.env` files in both `client` and `server` directories.
- **Server `.env`**: Set up database credentials, JWT secret, and API keys.
- **Client `.env`**: Set up the application URL and Mapbox access token.

### Database Setup
Ensure you have MySQL installed and running.
Run the `database.sql` script located in the `server/` directory to create the `cityflow_db` database, tables, triggers, and seed data:
```bash
mysql -u root -p < server/database.sql
```

## 5. Usage

To run the application, you need to start both the server and the frontend client.

**Run the Backend (Server):**
```bash
cd server
npm run dev
```

**Run the Frontend (Client):**
```bash
cd client
npm run dev
```

**Key API Endpoints / Workflow:**
- `POST /api/rides/request` - Request a ride.
- `POST /api/rides/accept` - Driver accepts a ride (utilizes strict database transactions).
- `POST /api/payments/process` - Complete trip and settle fare.

## 6. Project Structure

```text
CityFlow/
├── client/                 # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── config/         # Mapbox/API setup
│   │   ├── pages/          # App pages/views
│   │   └── styles/         # CSS and theme
│   ├── package.json
│   └── vite.config.js
├── server/                 # Node.js backend
│   ├── config/             # DB configurations
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Auth, validation, rate limiting
│   ├── models/             # Database access queries
│   ├── routes/             # API routing
│   ├── utils/              # Helper functions
│   ├── validators/         # Zod schemas
│   ├── database.sql        # Database schema, triggers & seed
│   ├── index.js            # Entry point
│   └── package.json
└── README.md
```

## 7. Performance / Metrics
*(Space reserved for performance and test metrics)*
- Handles concurrent user transactions safely using ACID-compliant mechanisms.
- Database query response times optimized via structured indexing.
- (To be added: Scalability & Load Testing numbers)

## 8. Challenges & Learnings
- **Database Concurrency Control:** Handling ride acceptance requests simultaneously from multiple drivers posed a risk of race conditions resulting in double bookings or deadlocks. We solved this by using strict transaction blocks and `SELECT ... FOR UPDATE` pessimistic locks in MySQL.
- **Real-Time Geospatial Logic:** Calculating distances and linking drivers to the right operational zones dynamically.
- **Complex Triggers:** Maintaining driver ratings, total rides, and system logs seamlessly through backend database triggers without slowing down application responses.

## 9. Future Improvements
- **WebSocket Integration:** Transition from standard polling/REST calls to WebSockets for sub-second, real-time map updates.
- **Admin Analytics Dashboard:** Advanced charts to visualize zone-wise revenue and user growth correctly.
- **Multi-language Support:** Localizing the platform for diverse geographical regions.
- **Voice Capabilities:** Integrating voice communication or voice-based ride booking.

## 10. Contributing
Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 11. License
Distributed under the MIT License.

## 12. Contact / Authors

**Contributors:**
- Contributor 1 - [GitHub](https://github.com/) | [LinkedIn](https://linkedin.com/in/)
- Contributor 2 - [GitHub](https://github.com/) | [LinkedIn](https://linkedin.com/in/)
- Contributor 3 - [GitHub](https://github.com/) | [LinkedIn](https://linkedin.com/in/)

Project Link: [https://github.com/yourusername/CityFlow](https://github.com/yourusername/CityFlow)