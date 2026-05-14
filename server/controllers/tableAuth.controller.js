import UserModel from "../models/user.model.js";
import TableModel from "../models/table.model.js";
import TableOrderModel from "../models/tableOrder.model.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyTableToken } from "../utils/qrCodeGenerator.js";

/**
 * Create a table account for a specific table
 */
export async function createTableAccountController(request, response) {
    try {
        const { tableId, tableNumber } = request.body;

        if (!tableId || !tableNumber) {
            return response.status(400).json({
                message: "Vui lòng cung cấp tableId và tableNumber",
                error: true, success: false
            });
        }

        const table = await TableModel.findById(tableId);
        if (!table) return response.status(404).json({ message: "Không tìm thấy bàn", error: true, success: false });

        if (table.tableAccountId) return response.status(400).json({ message: "Bàn này đã có tài khoản", error: true, success: false });

        const tableEmail = `table_${tableNumber.toLowerCase()}@internal.restaurant.com`;
        const randomPassword = Math.random().toString(36).slice(-12);
        const salt = await bcryptjs.genSalt(10);
        const hashPassword = await bcryptjs.hash(randomPassword, salt);

        const tableUser = new UserModel({
            name: `Bàn ${tableNumber}`,
            email: tableEmail,
            password: hashPassword,
            role: "TABLE",
            linkedTableId: tableId,
            verify_email: true,
            status: "Active"
        });

        const savedUser = await tableUser.save();
        table.tableAccountId = savedUser._id;
        await table.save();

        return response.status(201).json({
            message: "Tạo tài khoản bàn thành công",
            data: { userId: savedUser._id, email: tableEmail, tableNumber },
            error: false, success: true
        });
    } catch (error) {
        return response.status(500).json({ message: error.message || error, error: true, success: false });
    }
}

/**
 * Login via QR code token
 */
export async function loginViaQRController(request, response) {
    try {
        const { token } = request.body;
        if (!token) return response.status(400).json({ message: "Vui lòng cung cấp token", error: true, success: false });

        let decoded;
        try {
            decoded = verifyTableToken(token);
        } catch (error) {
            return response.status(401).json({ message: "Mã QR không hợp lệ.", error: true, success: false });
        }

        const table = await TableModel.findById(decoded.tableId).populate('tableAccountId');
        if (!table || !table.tableAccountId) {
            return response.status(404).json({ message: "Thông tin bàn không hợp lệ", error: true, success: false });
        }

        const tableUser = table.tableAccountId;

        const accessToken = jwt.sign(
            { _id: tableUser._id, role: tableUser.role, tableId: table._id, tableNumber: table.tableNumber },
            process.env.SECRET_KEY_ACCESS_TOKEN,
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { _id: tableUser._id, role: tableUser.role },
            process.env.SECRET_KEY_REFRESH_TOKEN,
            { expiresIn: '7d' }
        );

        await UserModel.findByIdAndUpdate(tableUser._id, { refresh_token: refreshToken });

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        };

        response.cookie('accessToken', accessToken, cookieOptions);
        response.cookie('refreshToken', refreshToken, cookieOptions);

        const activeOrder = await TableOrderModel.findOne({
            tableId: table._id,
            status: { $in: ['active', 'pending_payment'] }
        });
        const hasActiveSession = !!activeOrder;
        const activeOrderItemCount = activeOrder ? activeOrder.items.length : 0;

        return response.status(200).json({
            message: "Đăng nhập thành công",
            data: {
                accessToken,
                user: {
                    _id: tableUser._id,
                    name: tableUser.name,
                    role: tableUser.role,
                    tableId: table._id,
                    tableNumber: table.tableNumber
                },
                sessionInfo: { hasActiveSession, activeOrderItemCount }
            },
            error: false, success: true
        });
    } catch (error) {
        return response.status(500).json({ message: error.message || error, error: true, success: false });
    }
}

/**
 * Quick register a customer at the table
 */
export async function quickRegisterCustomerController(request, response) {
    try {
        const { name, mobile, password, tableId } = request.body;

        if (!name || !mobile || !password || !tableId) {
            return response.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin", error: true, success: false });
        }

        const existingUser = await UserModel.findOne({ mobile });
        if (existingUser) return response.status(400).json({ message: "Số điện thoại đã được đăng ký", error: true, success: false });

        const salt = await bcryptjs.genSalt(10);
        const hashPassword = await bcryptjs.hash(password, salt);

        const newUser = new UserModel({
            name,
            email: `${mobile}@eatease-member.com`,
            mobile,
            password: hashPassword,
            role: "CUSTOMER",
            linkedTableId: tableId,
            status: "Active"
        });

        const savedUser = await newUser.save();
        return finalizeCustomerTableLogin(savedUser, tableId, response);
    } catch (error) {
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}

/**
 * Link an existing customer account to the current table
 */
export async function linkCustomerToTableController(request, response) {
    try {
        const { mobile, password, tableId } = request.body;

        if (!mobile || !password || !tableId) {
            return response.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin", error: true, success: false });
        }

        const user = await UserModel.findOne({ mobile, role: "CUSTOMER" });
        if (!user) return response.status(404).json({ message: "Tài khoản không tồn tại", error: true, success: false });

        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) return response.status(401).json({ message: "Mật khẩu không chính xác", error: true, success: false });

        user.linkedTableId = tableId;
        await user.save();

        return finalizeCustomerTableLogin(user, tableId, response);
    } catch (error) {
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}

/**
 * Finalize customer login and issue tokens
 */
async function finalizeCustomerTableLogin(user, tableId, response) {
    const table = await TableModel.findById(tableId);
    if (!table) return response.status(404).json({ message: "Không tìm thấy bàn", error: true, success: false });

    const activeOrder = await TableOrderModel.findOne({
        tableId: tableId,
        status: { $in: ['active', 'pending_payment'] }
    });

    if (activeOrder) {
        activeOrder.userId = user._id;
        await activeOrder.save();
    }

    const accessToken = jwt.sign(
        { _id: user._id, role: user.role, tableId: table._id, tableNumber: table.tableNumber },
        process.env.SECRET_KEY_ACCESS_TOKEN,
        { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
        { _id: user._id, role: user.role },
        process.env.SECRET_KEY_REFRESH_TOKEN,
        { expiresIn: '7d' }
    );

    await UserModel.findByIdAndUpdate(user._id, { refresh_token: refreshToken });

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    };

    response.cookie('accessToken', accessToken, cookieOptions);
    response.cookie('refreshToken', refreshToken, cookieOptions);

    return response.status(200).json({
        message: "Xác thực danh tính thành công",
        data: {
            accessToken,
            user: {
                _id: user._id,
                name: user.name,
                mobile: user.mobile,
                role: user.role,
                rewardsPoint: user.rewardsPoint,
                tierPoints: user.tierPoints,
                tierLevel: user.tierLevel,
                tableId: table._id,
                tableNumber: table.tableNumber
            }
        },
        error: false, success: true
    });
}

/**
 * Get current table session info
 */
export async function getTableSessionController(request, response) {
    try {
        const userId = request.userId;
        const user = await UserModel.findById(userId).populate('linkedTableId');

        if (!user) return response.status(404).json({ message: "Không tìm thấy người dùng", error: true, success: false });

        const table = user.linkedTableId;
        if (!table) return response.status(400).json({ message: "Người dùng không được liên kết với bàn nào", error: true, success: false });

        return response.status(200).json({
            message: "Thành công",
            data: {
                userId: user._id,
                userName: user.name,
                tableId: table._id,
                tableNumber: table.tableNumber,
                tableCapacity: table.capacity,
                tableLocation: table.location
            },
            error: false, success: true
        });
    } catch (error) {
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}

/**
 * Logout table session
 */
export async function logoutTableController(request, response) {
    try {
        const userId = request.userId;
        await UserModel.findByIdAndUpdate(userId, { refresh_token: "" });
        response.clearCookie('accessToken');
        response.clearCookie('refreshToken');
        return response.status(200).json({ message: "Đăng xuất thành công", error: false, success: true });
    } catch (error) {
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}
