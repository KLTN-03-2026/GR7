import jwt from "jsonwebtoken";
import UserModel from "../models/user.model.js";

/**
 * Optional Auth middleware
 * - Nếu có token hợp lệ → parse user vào req.user
 * - Nếu không có token hoặc token lỗi → bỏ qua, tiếp tục (req.user = null)
 * - KHÔNG block request — dùng cho route vừa Guest vừa Logged-in
 */
const optionalAuth = async (req, res, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.headers?.authorization?.split(" ")[1];

        if (!token) {
            req.userId = null;
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(
            token,
            process.env.SECRET_KEY_ACCESS_TOKEN
        );

        req.userId = decoded.id || decoded._id;

        const user = await UserModel.findById(req.userId)
            .select("name email role rewardsPoint tierLevel tierBenefits orderHistory");

        req.user = user || null;
    } catch (err) {
        // Token invalid/expired → treat as guest
        req.userId = null;
        req.user = null;
    }

    next();
};

export default optionalAuth;
