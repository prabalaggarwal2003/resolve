import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { auth, signup, health, assets, issues, dashboard, notifications, users, locations, departments, publicRoutes } from './routes/index.js';

const app = express();

// Handle CORS with multiple origins
const allowedOrigins = [
  env.frontendUrl,
  env.frontendUrl?.replace(/\/$/, ''), // Remove trailing slash
  env.frontendUrl?.replace(/\/$/, '') + '/', // Add trailing slash if missing
  // Development origins
  'http://localhost:3000',
  'http://localhost:3000/',
  'https://localhost:3000',
  'https://localhost:3000/',
].filter(Boolean);

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use('/api/health', health);
app.use('/api/public', publicRoutes);
app.use('/api/auth', auth);
app.use('/api/auth/signup', signup);
app.use('/api/assets', assets);
app.use('/api/issues', issues);
app.use('/api/dashboard', dashboard);
app.use('/api/notifications', notifications);
app.use('/api/users', users);
app.use('/api/locations', locations);
app.use('/api/departments', departments);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

export default app;
