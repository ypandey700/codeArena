const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
  });
});

app.use('/api/v1', apiRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

module.exports = app;
