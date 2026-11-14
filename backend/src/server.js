require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
require('./config/redis');
const { initSocket } = require('./sockets');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const startServer = async () => {
  await connectDB();
  initSocket(server);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
