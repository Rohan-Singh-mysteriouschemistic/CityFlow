const express = require('express');
const cors    = require('cors');
require('dotenv').config();
require('./config/db');

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'CityFlow Delhi', time: new Date() });
});

// Routes (we'll add these one by one)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rides',   require('./routes/rides'));
// app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/admin',   require('./routes/admin'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 CityFlow server running on port ${PORT}`);
});