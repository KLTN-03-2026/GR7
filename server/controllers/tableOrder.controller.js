import TableOrderModel from '../models/tableOrder.model.js';
import ProductModel from '../models/product.model.js';
import UserModel from '../models/user.model.js';
import VoucherModel from '../models/voucher.model.js';
import mongoose from 'mongoose';
import Stripe from '../config/stripe.js';
import BookingModel from '../models/booking.model.js';
import PaymentModel from '../models/payment.model.js';
import LoyaltyTransactionModel from '../models/loyaltyTransaction.model.js';

// Add items to table order
export async function addItemsToTableOrder(request, response) {
    try {
        const userId = request.userId;
        const { items, tableNumber } = request.body;

        if (!items || items.length === 0) {
            return response.status(400).json({ message: 'Vui lòng chọn món', error: true, success: false });
        }

        const user = await UserModel.findById(userId);
        if (!user || (user.role !== 'TABLE' && user.role !== 'CUSTOMER')) {
            return response.status(403).json({ message: 'Bạn không có quyền gọi món tại đây', error: true, success: false });
        }

        const tableId = user.linkedTableId;
        if (!tableId) {
            return response.status(400).json({ message: 'Tài khoản chưa được liên kết với bàn', error: true, success: false });
        }
        const actualTableNumber = tableNumber || user.email.split('_')[1]?.split('@')[0]?.toUpperCase();

        // Tìm đơn hàng đang hoạt động hoặc đang chờ thanh toán (để khôi phục nếu khách quay lại)
        let tableOrder = await TableOrderModel.findOne({
            tableId: tableId,
            status: { $in: ['active', 'pending_payment'] }
        });

        const itemsToAdd = [];
        let subTotal = 0;

        for (const item of items) {
            const qty = parseInt(item.quantity);
            if (!qty || qty < 1 || !Number.isInteger(qty)) {
                return response.status(400).json({ message: 'Số lượng món ăn không hợp lệ.', error: true, success: false });
            }

            const product = await ProductModel.findById(item.productId);
            if (!product || product.status !== 'available') {
                return response.status(404).json({ message: `"${product?.name || 'Món ăn'}" hiện không khả dụng.`, error: true, success: false });
            }

            subTotal += product.price * qty;
            itemsToAdd.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: qty,
                note: item.note || '',
                addedAt: new Date()
            });
        }

        if (tableOrder) {
            tableOrder.items.push(...itemsToAdd);
            tableOrder.subTotal += subTotal;
            // Cập nhật lại tổng tiền sau khi áp dụng Voucher/Points cũ (nếu có)
            tableOrder.total = Math.max(0, tableOrder.subTotal - (tableOrder.discount || 0) - (tableOrder.pointsDiscount || 0));

            // Nếu đơn đang là pending_payment (khách vừa Back từ Stripe), đưa nó về active để gọi thêm món
            tableOrder.status = 'active';
            tableOrder.paymentStatus = 'Chờ xử lý';
            tableOrder.paymentRequest = null;
            tableOrder.stripeSessionId = null;

            // Cập nhật userId nếu khách vừa mới đăng nhập/liên kết tài khoản
            if (user.role === 'CUSTOMER' && !tableOrder.userId) {
                tableOrder.userId = userId;
            }

            await tableOrder.save();
        } else {
            tableOrder = await TableOrderModel.create({
                tableId: tableId,
                userId: user.role === 'CUSTOMER' ? userId : null,
                tableNumber: actualTableNumber,
                items: itemsToAdd,
                subTotal: subTotal,
                total: subTotal,
                status: 'active'
            });
        }

        return response.status(200).json({
            message: 'Đã thêm món vào đơn',
            error: false,
            success: true,
            data: tableOrder
        });

    } catch (error) {
        console.error('Error adding items to table order:', error);
        return response.status(500).json({ message: error.message || 'Lỗi khi thêm món', error: true, success: false });
    }
}

// Get current table order
export async function getCurrentTableOrder(request, response) {
    try {
        const userId = request.userId;
        const user = await UserModel.findById(userId);
        if (!user || (user.role !== 'TABLE' && user.role !== 'CUSTOMER')) {
            return response.status(403).json({ message: 'Không có quyền truy cập', error: true, success: false });
        }

        const tableOrder = await TableOrderModel.findOne({
            tableId: user.linkedTableId,
            status: { $in: ['active', 'pending_payment'] }
        }).populate('items.productId', 'name image');

        if (!tableOrder) {
            return response.status(200).json({ message: 'Chưa có món nào được gọi', error: false, success: true, data: null });
        }

        return response.status(200).json({ message: 'Lấy đơn hàng thành công', error: false, success: true, data: tableOrder });
    } catch (error) {
        console.error('Error getting table order:', error);
        return response.status(500).json({ message: error.message || 'Lỗi khi lấy đơn hàng', error: true, success: false });
    }
}

// Checkout table order
export async function checkoutTableOrder(request, response) {
    try {
        const userId = request.userId;
        const { paymentMethod } = request.body;

        const user = await UserModel.findById(userId);
        if (!user || (user.role !== 'TABLE' && user.role !== 'CUSTOMER')) {
            return response.status(403).json({ message: 'Không có quyền thanh toán', error: true, success: false });
        }

        const tableOrder = await TableOrderModel.findOne({
            tableId: user.linkedTableId,
            status: { $in: ['active', 'pending_payment'] }
        }).populate('items.productId', 'name image');

        if (!tableOrder || tableOrder.items.length === 0) {
            return response.status(404).json({ message: 'Không có đơn hàng nào để thanh toán', error: true, success: false });
        }

        const unservedItems = tableOrder.items.filter(item => item.kitchenStatus !== 'served');
        if (unservedItems.length > 0) {
            return response.status(400).json({
                message: `Còn ${unservedItems.length} món chưa được phục vụ. Vui lòng chờ nhân viên mang món ra bàn trước khi thanh toán.`,
                error: true,
                success: false
            });
        }

        if (paymentMethod === 'at_counter') {
            tableOrder.status = 'pending_payment';
            tableOrder.paymentStatus = 'Chờ thanh toán';
            tableOrder.paymentRequest = 'at_counter';
            tableOrder.checkedOutAt = new Date();
            await tableOrder.save();

            return response.status(200).json({ message: 'Yêu cầu thanh toán tại quầy thành công', error: false, success: true });
        } else {
            // Online payment via Stripe
            const total = tableOrder.total;
            const subTotal = tableOrder.subTotal;
            const ratio = subTotal > 0 ? total / subTotal : 1;

            let allocatedTotal = 0;
            const line_items = tableOrder.items.map((item, index) => {
                let unit_amount;
                if (index === tableOrder.items.length - 1) {
                    unit_amount = Math.round((total - allocatedTotal) / item.quantity);
                } else {
                    unit_amount = Math.round(item.price * ratio);
                    allocatedTotal += unit_amount * item.quantity;
                }

                return {
                    price_data: {
                        currency: 'vnd',
                        product_data: {
                            name: total < subTotal ? `${item.name} (Đã giảm giá)` : item.name,
                            metadata: { productId: item.productId._id.toString() }
                        },
                        unit_amount: Math.max(0, unit_amount),
                    },
                    quantity: item.quantity
                };
            });

            const stripeSession = await Stripe.checkout.sessions.create({
                submit_type: 'pay',
                mode: 'payment',
                payment_method_types: ['card'],
                customer_email: user.email,
                metadata: {
                    userId: userId.toString(),
                    tableOrderId: tableOrder._id.toString(),
                    orderType: 'dine_in'
                },
                line_items,
                success_url: `${process.env.FRONTEND_URL}/table-payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/table-menu`
            });

            tableOrder.stripeSessionId = stripeSession.id;
            tableOrder.status = 'pending_payment';
            tableOrder.paymentStatus = 'Chờ thanh toán';
            tableOrder.paymentRequest = 'online';
            tableOrder.checkedOutAt = new Date();
            await tableOrder.save();

            return response.status(200).json({ success: true, data: { checkoutUrl: stripeSession.url } });
        }
    } catch (error) {
        console.error('Error checkout table order:', error);
        return response.status(500).json({ message: error.message || 'Lỗi khi thanh toán', error: true, success: false });
    }
}

// Cancel table order
export async function cancelTableOrder(request, response) {
    try {
        const userId = request.userId;
        const user = await UserModel.findById(userId);
        if (!user || user.role !== 'TABLE') {
            return response.status(403).json({ message: 'Không có quyền hủy đơn', error: true, success: false });
        }

        const tableOrder = await TableOrderModel.findOne({ tableId: user.linkedTableId, status: 'active' });
        if (!tableOrder) {
            return response.status(404).json({ message: 'Không tìm thấy đơn hàng', error: true, success: false });
        }

        tableOrder.status = 'cancelled';
        tableOrder.paymentStatus = 'Đã hủy';
        await tableOrder.save();

        return response.status(200).json({ message: 'Đã hủy đơn hàng', error: false, success: true });
    } catch (error) {
        console.error('Error cancelling table order:', error);
        return response.status(500).json({ message: error.message || 'Lỗi khi hủy đơn', error: true, success: false });
    }
}

// 5. Get all active or pending payment table orders (Admin/Waiter)
export async function getAllActiveTableOrders(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'WAITER', 'CHEF', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({ message: 'Không có quyền truy cập', error: true, success: false });
        }

        // Chỉ lấy đơn 'active' HOẶC đơn 'pending_payment' mà đang 'Chờ thanh toán'
        const tableOrders = await TableOrderModel.find({
            $or: [
                { status: 'active' },
                { status: 'pending_payment', paymentStatus: 'Chờ thanh toán' }
            ]
        }).sort({ updatedAt: -1 });

        return response.status(200).json({ success: true, data: tableOrders });
    } catch (error) {
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}

// List cashier pending orders
export async function getCashierPendingOrders(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({ message: 'Không có quyền truy cập', error: true, success: false });
        }

        const orders = await TableOrderModel.find({
            status: 'pending_payment',
            paymentRequest: 'at_counter'
        }).sort({ checkedOutAt: 1 });

        return response.status(200).json({ success: true, data: orders });
    } catch (error) {
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}

// Cashier confirms cash payment
export async function confirmCashierPayment(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({ message: 'Không có quyền thực hiện', error: true, success: false });
        }

        const { tableOrderId } = request.body;
        const tableOrder = await TableOrderModel.findById(tableOrderId);
        if (!tableOrder || tableOrder.status !== 'pending_payment') {
            return response.status(400).json({ message: 'Đơn hàng không hợp lệ để thanh toán', error: true, success: false });
        }

        tableOrder.status = 'Closed';
        tableOrder.paymentStatus = 'paid';
        tableOrder.paymentMethod = 'cash';
        tableOrder.paidAt = new Date();

        if (tableOrder.userId) {
            const earned = await processLoyaltyPoints(tableOrder.userId, tableOrder.total, tableOrder._id, null);
            tableOrder.rewardPointsEarned = earned;
        }

        await tableOrder.save();
        return response.status(200).json({ message: 'Thanh toán thành công', error: false, success: true });
    } catch (error) {
        console.error('Error confirming cashier payment:', error);
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}

// Waiter cancels an item
export async function cancelTableOrderItem(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'WAITER'].includes(user.role)) {
            return response.status(403).json({ message: 'Không có quyền huỷ món', error: true, success: false });
        }

        const { orderId, itemId } = request.params;
        const tableOrder = await TableOrderModel.findById(orderId);
        if (!tableOrder) return response.status(404).json({ message: 'Không tìm thấy đơn hàng', error: true, success: false });

        const item = tableOrder.items.id(itemId);
        if (!item || item.kitchenStatus !== 'pending') {
            return response.status(400).json({ message: 'Chỉ có thể hủy món đang chờ bếp', error: true, success: false });
        }

        tableOrder.items.pull(itemId);
        const subTotal = tableOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        tableOrder.subTotal = subTotal;
        tableOrder.total = Math.max(0, subTotal - (tableOrder.discount || 0) - (tableOrder.pointsDiscount || 0));
        await tableOrder.save();

        return response.status(200).json({ message: 'Đã huỷ món thành công', success: true });
    } catch (error) {
        return response.status(500).json({ message: error.message, error: true, success: false });
    }
}

// Stripe Webhook
export async function handleStripeWebhook(request, response) {
    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_CLI_WEBHOOK_SECRET || process.env.STRIPE_ENPOINT_WEBHOOK_SECRET_KEY;

    let event;
    try {
        event = Stripe.webhooks.constructEvent(request.rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('[Stripe Webhook] Error:', err.message);
        return response.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};

        if (metadata.orderType === 'dine_in' && metadata.tableOrderId) {
            try {
                const tableOrder = await TableOrderModel.findById(metadata.tableOrderId);
                if (tableOrder && tableOrder.status !== 'Closed') {
                    tableOrder.status = 'Closed';
                    tableOrder.paymentStatus = 'paid';
                    tableOrder.paymentMethod = 'stripe';
                    tableOrder.paidAt = new Date();

                    if (tableOrder.userId) {
                        await processLoyaltyPoints(tableOrder.userId, tableOrder.total, tableOrder._id, null);
                    }

                    const payment = new PaymentModel({
                        amount: tableOrder.total,
                        currency: 'VND',
                        paymentMethod: 'stripe',
                        paymentStatus: 'completed',
                        userId: tableOrder.userId,
                        tableOrderId: tableOrder._id,
                        stripeSessionId: session.id,
                        stripePaymentIntentId: session.payment_intent
                    });
                    payment.generateReceiptNumber();
                    await payment.save();

                    tableOrder.paymentId = payment._id;
                    await tableOrder.save();
                }
            } catch (err) {
                console.error('[Stripe Webhook] Error processing order:', err);
            }
        }
    }
    return response.status(200).json({ received: true });
}

// Verify Stripe Session
export async function verifyStripeSession(request, response) {
    try {
        const { session_id } = request.query;
        if (!session_id) return response.status(400).json({ message: 'session_id là bắt buộc' });

        const tableOrder = await TableOrderModel.findOne({ stripeSessionId: session_id });
        if (!tableOrder) return response.status(404).json({ message: 'Không tìm thấy đơn hàng' });

        return response.status(200).json({
            success: true,
            data: {
                status: tableOrder.paymentStatus === 'paid' ? 'paid' : 'pending',
                tableNumber: tableOrder.tableNumber,
                total: tableOrder.total,
                items: tableOrder.items
            }
        });
    } catch (error) {
        return response.status(500).json({ message: error.message });
    }
}

// Apply Voucher
export async function applyVoucherToTableOrder(request, response) {
    try {
        const { id } = request.params;
        const { voucherCode } = request.body;
        const tableOrder = await TableOrderModel.findById(id);
        const voucher = await VoucherModel.findOne({ code: voucherCode?.trim().toUpperCase(), isActive: true });

        if (!voucher) return response.status(400).json({ message: 'Mã giảm giá không tồn tại hoặc hết hạn' });

        let discount = 0;
        if (voucher.discountType === 'percentage') {
            discount = (tableOrder.subTotal * voucher.discountValue) / 100;
            if (voucher.maxDiscount) discount = Math.min(discount, voucher.maxDiscount);
        } else {
            discount = Math.min(voucher.discountValue, tableOrder.subTotal);
        }
        discount = Math.round(discount);

        tableOrder.discount = discount;
        tableOrder.voucherId = voucher._id;
        tableOrder.total = Math.max(0, tableOrder.subTotal - discount - (tableOrder.pointsDiscount || 0));
        await tableOrder.save();

        return response.status(200).json({ success: true, message: 'Áp dụng mã thành công', data: { newTotal: tableOrder.total } });
    } catch (error) {
        return response.status(500).json({ message: 'Lỗi server khi áp dụng voucher' });
    }
}

// Remove Voucher
export async function removeVoucherFromTableOrder(request, response) {
    try {
        const { id } = request.params;
        const tableOrder = await TableOrderModel.findById(id);
        if (!tableOrder) return response.status(404).json({ message: 'Không tìm thấy đơn' });

        tableOrder.discount = 0;
        tableOrder.voucherId = null;
        tableOrder.total = Math.max(0, tableOrder.subTotal - (tableOrder.pointsDiscount || 0));
        await tableOrder.save();

        return response.status(200).json({ success: true, message: 'Đã hủy mã giảm giá' });
    } catch (error) {
        return response.status(500).json({ message: 'Lỗi server' });
    }
}

// Internal Loyalty Points logic
async function processLoyaltyPoints(userId, totalAmount, orderId, session) {
    if (!userId) return 0;
    const user = await UserModel.findById(userId).session(session);
    if (!user || user.role !== 'CUSTOMER') return 0;

    // Apply Tier Multiplier
    const multiplier = user.tierBenefits?.pointsMultiplier || 1.0;
    const basePoints = Math.floor(totalAmount / 10000);
    const earnedPoints = Math.floor(basePoints * multiplier);

    if (earnedPoints <= 0) return 0;

    const oldBalance = user.rewardsPoint || 0;
    user.rewardsPoint = oldBalance + earnedPoints;

    // Tier leveling logic (Silver, Gold, Platinum)
    let newTier = 'bronze';
    let newMultiplier = 1.0;

    if (user.rewardsPoint >= 5000) {
        newTier = 'platinum';
        newMultiplier = 2.0;
    } else if (user.rewardsPoint >= 2000) {
        newTier = 'gold';
        newMultiplier = 1.5;
    } else if (user.rewardsPoint >= 500) {
        newTier = 'silver';
        newMultiplier = 1.2;
    }

    if (newTier !== user.tierLevel) {
        user.tierLevel = newTier;
        user.tierBenefits = { pointsMultiplier: newMultiplier };
    }

    await user.save({ session });

    // Create Loyalty Transaction
    const transaction = new LoyaltyTransactionModel({
        userId,
        orderId,
        pointsChange: earnedPoints,
        type: 'earn',
        balanceAfter: user.rewardsPoint,
        description: `Tích điểm từ đơn hàng (Hạng ${user.tierLevel}, x${multiplier})`
    });
    await transaction.save({ session });

    return earnedPoints;
}

// Apply Reward Points
export async function applyRewardPointsToTableOrder(request, response) {
    try {
        const { id } = request.params;
        const { pointsToUse } = request.body;
        const tableOrder = await TableOrderModel.findById(id);
        const user = await UserModel.findById(request.userId);

        if (!user || user.rewardsPoint < pointsToUse) {
            return response.status(400).json({ message: 'Không đủ điểm thưởng' });
        }

        const discount = pointsToUse * 100; // 1 điểm = 100 VNĐ
        const maxDiscountAllowed = Math.max(0, tableOrder.subTotal - (tableOrder.discount || 0));
        const actualDiscount = Math.min(discount, maxDiscountAllowed);

        // Calculate actual points used based on actual discount (if discount was capped)
        const actualPointsUsed = Math.ceil(actualDiscount / 100);

        tableOrder.pointsUsed = actualPointsUsed;
        tableOrder.pointsDiscount = actualDiscount;
        tableOrder.total = Math.max(0, tableOrder.subTotal - (tableOrder.discount || 0) - actualDiscount);

        await tableOrder.save();

        // NOTE: Transaction for redemption will be created when the order is PAID
        // to avoid issues if the user changes their mind before paying.

        return response.status(200).json({
            success: true,
            message: 'Áp dụng điểm thưởng thành công',
            data: { newTotal: tableOrder.total, pointsUsed: actualPointsUsed }
        });
    } catch (error) {
        return response.status(500).json({ message: 'Lỗi khi áp dụng điểm' });
    }
}

