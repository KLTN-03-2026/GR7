import { Router } from "express";
import auth from "../middleware/auth.js";
import {
    createTableAccountController,
    loginViaQRController,
    getTableSessionController,
    logoutTableController,
    quickRegisterCustomerController,
    linkCustomerToTableController
} from "../controllers/tableAuth.controller.js";

const tableAuthRouter = Router();

// Public routes
tableAuthRouter.post('/login-qr', loginViaQRController);
tableAuthRouter.post('/quick-register', quickRegisterCustomerController);
tableAuthRouter.post('/link-customer', linkCustomerToTableController);

// Protected routes (require authentication)
tableAuthRouter.post('/create-account', auth, createTableAccountController);
tableAuthRouter.get('/session', auth, getTableSessionController);
tableAuthRouter.post('/logout', auth, logoutTableController);

export default tableAuthRouter;
