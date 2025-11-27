require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const eventRoutes = require('./src/routes/events');

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3001', 
  credentials: true                
}));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes); 

mongoose.connect(process.env.CONNECTION_STRING)
  .then(() => console.log('Connected to database'))
  .catch(err => console.error('Database connection error:', err));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
