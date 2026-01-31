import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { auth, signup, health, assets, issues, dashboard, notifications, users, locations, departments, publicRoutes } from './routes/index.js';

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
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
