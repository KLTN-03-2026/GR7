import { Router } from "express";
import { chatController } from "../controllers/chat.controller.js";
import optionalAuth from "../middleware/optionalAuth.js";

const chatRouter = Router();

// Public route với optional auth — Guest hoạt động bình thường, Logged-in có personalized AI
chatRouter.post("/message", optionalAuth, chatController);

export default chatRouter;