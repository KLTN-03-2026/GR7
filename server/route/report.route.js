import { Router } from 'express';
import auth from '../middleware/auth.js';
import { admin } from '../middleware/Admin.js';
import { getDashboardStats } from '../controllers/report.controller.js';

const reportRouter = Router();

reportRouter.get('/dashboard-stats', auth, admin, getDashboardStats);

export default reportRouter;
