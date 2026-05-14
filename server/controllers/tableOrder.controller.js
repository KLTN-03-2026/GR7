import TableOrderModel from '../models/tableOrder.model.js';
import ProductModel from '../models/product.model.js';
import UserModel from '../models/user.model.js';
import VoucherModel from '../models/voucher.model.js';
import mongoose from 'mongoose';
import Stripe from '../config/stripe.js';
import BookingModel from '../models/booking.model.js';

// Add items to table order
export async function addItemsToTableOrder(request, response) {
    try {
        const userId = request.userId;
        const { items, tableNumber } = request.body;

        if (!items || items.length === 0) {
            return response.status(400).json({
                message: 'Vui lòng chọn món',
                error: true,
                success: false
            });
        }

        // Get user's table info
        const user = await UserModel.findById(userId);
        console.log('User found:', user ? { id: user._id, role: user.role, email: user.email } : 'null');

        if (!user || user.role !== 'TABLE') {
            console.log('Access denied - User role:', user?.role);
            return response.status(403).json({
                message: 'Chỉ tài khoản bàn mới có thể gọi món',
                error: true,
                success: false
            });
        }

        const tableId = user.linkedTableId;
        const actualTableNumber = tableNumber || user.email.split('_')[1]?.split('@')[0]?.toUpperCase();

        // Find or create active table order
        let tableOrder = await TableOrderModel.findOne({
            tableId: tableId,
            status: 'active'
        });

        // Prepare items with product details
        const itemsToAdd = [];
        let subTotal = 0;

        for (const item of items) {
            // AC 7.4 – Validate quantity
            const qty = parseInt(item.quantity);
            if (!qty || qty < 1 || !Number.isInteger(qty)) {
                return response.status(400).json({
                    message: 'Số lượng món ăn không hợp lệ.',
                    error: true,
                    success: false
                });
            }

            // AC 7.1 – Product must exist
            const product = await ProductModel.findById(item.productId);
            if (!product) {
                return response.status(404).json({
                    message: 'Món ăn không tồn tại.',
                    error: true,
                    success: false
                });
            }

            // Validate stock still uses status field
            const isProductAvailable = product.status === 'available';
            if (!isProductAvailable) {
                return response.status(400).json({
                    message: `"${product.name}" hiện không khả dụng.`,
                    error: true,
                    success: false
                });
            }

            // AC 7.3 – qty check (no stock field, just validate positive)
            // stock field đã xóa — chỉ validate qty > 0

            const itemTotal = product.price * qty;
            subTotal += itemTotal;

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
            // Update existing order
            tableOrder.items.push(...itemsToAdd);
            tableOrder.subTotal += subTotal;
            tableOrder.total = tableOrder.subTotal;

            if (['Đã phục vụ', 'Đang chuẩn bị'].includes(tableOrder.paymentStatus)) {
                tableOrder.paymentStatus = 'Chờ xử lý';
            }

            await tableOrder.save();
        } else {
            // Create new order
            tableOrder = await TableOrderModel.create({
                tableId: tableId,
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
            data: {
                tableOrder: tableOrder,
                itemsAdded: itemsToAdd.length
            }
        });

    } catch (error) {
        console.error('Error adding items to table order:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi khi thêm món',
            error: true,
            success: false
        });
    }
}

// Get current table order
export async function getCurrentTableOrder(request, response) {
    try {
        const userId = request.userId;

        const user = await UserModel.findById(userId);
        if (!user || user.role !== 'TABLE') {
            return response.status(403).json({
                message: 'Chỉ tài khoản bàn mới có thể xem đơn',
                error: true,
                success: false
            });
        }

        const tableOrder = await TableOrderModel.findOne({
            tableId: user.linkedTableId,
            status: 'active'
        }).populate('items.productId', 'name image');

        if (!tableOrder) {
            return response.status(200).json({
                message: 'Chưa có món nào được gọi',
                error: false,
                success: true,
                data: null
            });
        }

        return response.status(200).json({
            message: 'Lấy đơn hàng thành công',
            error: false,
            success: true,
            data: tableOrder
        });

    } catch (error) {
        console.error('Error getting table order:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi khi lấy đơn hàng',
            error: true,
            success: false
        });
    }
}

// Checkout table order
export async function checkoutTableOrder(request, response) {
    try {
        const userId = request.userId;
        const { paymentMethod } = request.body;

        if (!paymentMethod || !['at_counter', 'online'].includes(paymentMethod)) {
            return response.status(400).json({
                message: 'Vui lòng chọn phương thức thanh toán',
                error: true,
                success: false
            });
        }

        const user = await UserModel.findById(userId);
        if (!user || user.role !== 'TABLE') {
            return response.status(403).json({
                message: 'Chỉ tài khoản bàn mới có thể thanh toán',
                error: true,
                success: false
            });
        }

        const tableOrder = await TableOrderModel.findOne({
            tableId: user.linkedTableId,
            status: 'active'
        }).populate('items.productId', 'name image');

        if (!tableOrder || tableOrder.items.length === 0) {
            return response.status(404).json({
                message: 'Không có đơn hàng nào để thanh toán',
                error: true,
                success: false
            });
        }

        // AC: Tất cả món phải ở trạng thái 'served' trước khi được phép thanh toán
        const unservedItems = tableOrder.items.filter(item => item.kitchenStatus !== 'served');
        if (unservedItems.length > 0) {
            return response.status(400).json({
                message: `Còn ${unservedItems.length} món chưa được phục vụ. Vui lòng chờ nhân viên mang món ra bàn trước khi thanh toán.`,
                error: true,
                success: false
            });
        }

        if (paymentMethod === 'at_counter') {
            // At-counter: mark as pending_payment so Cashier can confirm cash later
            tableOrder.status = 'pending_payment';
            tableOrder.paymentStatus = 'Chờ thanh toán';
            tableOrder.paymentRequest = 'at_counter';
            tableOrder.checkedOutAt = new Date();
            await tableOrder.save();

            return response.status(200).json({
                message: 'Yeu cau thanh toan tai quay da duoc gui. Nhan vien se den ho tro ban.',
                error: false,
                success: true,
                data: { paymentMethod: 'at_counter' }
            });

        } else {
            // Online payment – create Stripe Checkout Session
            const line_items = tableOrder.items.map(item => ({
                price_data: {
                    currency: 'vnd',
                    product_data: {
                        name: item.name,
                        metadata: { productId: item.productId.toString() }
                    },
                    unit_amount: Math.round(item.price),
                },
                quantity: item.quantity
            }));

            const params = {
                submit_type: 'pay',
                mode: 'payment',
                payment_method_types: ['card'],
                customer_email: user.email,
                metadata: {
                    userId: userId.toString(),
                    tableOrderId: tableOrder._id.toString(),
                    tableNumber: tableOrder.tableNumber,
                    orderType: 'dine_in'
                },
                line_items,
                success_url: `${process.env.FRONTEND_URL}/table-payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/table-order-management`
            };

            const stripeSession = await Stripe.checkout.sessions.create(params);

            // Snapshot: save sessionId + expectedTotal for webhook verification
            tableOrder.stripeSessionId = stripeSession.id;
            tableOrder.expectedTotal = tableOrder.total;
            tableOrder.status = 'pending_payment';
            tableOrder.paymentStatus = 'Chờ thanh toán';
            tableOrder.paymentRequest = 'online';
            tableOrder.checkedOutAt = new Date();
            await tableOrder.save();

            return response.status(200).json({
                message: 'Tạo phiên thanh toán thành công',
                error: false,
                success: true,
                data: {
                    checkoutUrl: stripeSession.url,
                    sessionId: stripeSession.id
                }
            });
        }

    } catch (error) {
        console.error('Error checkout table order:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi khi thanh toán',
            error: true,
            success: false
        });
    }
}

// Cancel table order
export async function cancelTableOrder(request, response) {
    try {
        const userId = request.userId;

        const user = await UserModel.findById(userId);
        if (!user || user.role !== 'TABLE') {
            return response.status(403).json({
                message: 'Không có quyền hủy đơn',
                error: true,
                success: false
            });
        }

        const tableOrder = await TableOrderModel.findOne({
            tableId: user.linkedTableId,
            status: 'active'
        });

        if (!tableOrder) {
            return response.status(404).json({
                message: 'Không tìm thấy đơn hàng',
                error: true,
                success: false
            });
        }

        tableOrder.status = 'cancelled';
        tableOrder.paymentStatus = 'Đã hủy';
        await tableOrder.save();

        return response.status(200).json({
            message: 'Đã hủy đơn hàng',
            error: false,
            success: true
        });

    } catch (error) {
        console.error('Error cancelling table order:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi khi hủy đơn',
            error: true,
            success: false
        });
    }
}

// Get all active table orders (for Manager/Admin)
export async function getAllActiveTableOrders(request, response) {
    try {
        const userId = request.userId;

        const user = await UserModel.findById(userId);
        if (!user || !['ADMIN', 'WAITER', 'CHEF'].includes(user.role)) {
            return response.status(403).json({
                message: 'Không có quyền truy cập',
                error: true,
                success: false
            });
        }

        const tableOrders = await TableOrderModel.find({
            status: 'active'
        }).sort({ updatedAt: -1 });

        return response.status(200).json({
            message: 'Lấy danh sách đơn hàng thành công',
            error: false,
            success: true,
            data: tableOrders
        });

    } catch (error) {
        console.error('Error getting all table orders:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi khi lấy danh sách đơn hàng',
            error: true,
            success: false
        });
    }
}

// AC3 - List all at-counter pending payment orders (for Cashier dashboard)
export async function getCashierPendingOrders(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({
                message: 'Khong co quyen truy cap',
                error: true, success: false
            });
        }

        const orders = await TableOrderModel.find({
            status: 'pending_payment',
            paymentRequest: 'at_counter'
        }).sort({ checkedOutAt: 1 });

        return response.status(200).json({
            message: 'Danh sach don cho thanh toan',
            error: false,
            success: true,
            data: orders
        });
    } catch (error) {
        return response.status(500).json({
            message: error.message || 'Loi server',
            error: true, success: false
        });
    }
}

// AC9-12 - Cashier confirms cash payment
export async function confirmCashierPayment(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({
                message: 'Khong co quyen thuc hien',
                error: true, success: false
            });
        }

        const { tableOrderId } = request.body;

        const tableOrder = await TableOrderModel.findById(tableOrderId);
        if (!tableOrder) {
            return response.status(404).json({
                message: 'Khong tim thay hoa don.',
                error: true, success: false
            });
        }

        if (tableOrder.status !== 'pending_payment') {
            return response.status(400).json({
                message: 'Thanh toan chua hoan tat. Vui long kiem tra lai.',
                error: true, success: false
            });
        }

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                // tableOrder IS the order record — không cần tạo bản sao sang OrderModel nữa
                tableOrder.status = 'Closed';
                tableOrder.paymentStatus = 'paid';
                tableOrder.paymentMethod = 'cash';
                tableOrder.paidAt = new Date();

                // Trừ điểm thưởng nếu khách hàng có sử dụng để giảm giá hóa đơn
                if (tableOrder.pointsUsed > 0 && tableOrder.userId) {
                    await UserModel.findByIdAndUpdate(
                        tableOrder.userId,
                        { $inc: { rewardsPoint: -tableOrder.pointsUsed } },
                        { session }
                    );
                }

                // Tích điểm thưởng mới dựa trên tổng tiền thanh toán thực tế
                if (tableOrder.userId) {
                    const earned = await processLoyaltyPoints(tableOrder.userId, tableOrder.total, session);
                    tableOrder.rewardPointsEarned = earned;
                }

                await tableOrder.save({ session });
            });

            return response.status(200).json({
                message: 'Thanh toan thanh cong. Don hang da duoc hoan tat.',
                error: false,
                success: true,
                data: {
                    totalPaid: tableOrder.total,
                    tableNumber: tableOrder.tableNumber,
                    discount: tableOrder.discount || 0,
                    subTotal: tableOrder.subTotal
                }
            });
        } finally {
            await session.endSession();
        }
    } catch (error) {
        console.error('Error confirming cashier payment:', error);
        return response.status(500).json({
            message: error.message || 'Loi xac nhan thanh toan',
            error: true, success: false
        });
    }
}

// Waiter huỷ một món trong đơn (chỉ khi kitchenStatus === 'pending')
export async function cancelTableOrderItem(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'WAITER'].includes(user.role)) {
            return response.status(403).json({
                message: 'Không có quyền huỷ món',
                error: true, success: false
            });
        }

        const { orderId, itemId } = request.params;

        const tableOrder = await TableOrderModel.findById(orderId);
        if (!tableOrder) {
            return response.status(404).json({
                message: 'Không tìm thấy đơn hàng',
                error: true, success: false
            });
        }

        const item = tableOrder.items.id(itemId);
        if (!item) {
            return response.status(404).json({
                message: 'Không tìm thấy món trong đơn',
                error: true, success: false
            });
        }

        if (item.kitchenStatus !== 'pending') {
            return response.status(400).json({
                message: `Không thể huỷ món đang ở trạng thái "${item.kitchenStatus}". Chỉ huỷ được món chờ bếp.`,
                error: true, success: false
            });
        }

        // Xoá item khỏi mảng
        tableOrder.items.pull(itemId);

        // Tính lại tổng
        const subTotal = tableOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        tableOrder.subTotal = subTotal;
        tableOrder.total = Math.max(0, subTotal - (tableOrder.discount || 0));

        await tableOrder.save();

        return response.status(200).json({
            message: 'Đã huỷ món thành công',
            error: false, success: true,
            data: { orderId, itemId, newTotal: tableOrder.total }
        });

    } catch (error) {
        console.error('cancelTableOrderItem error:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi server',
            error: true, success: false
        });
    }
}

// ─────────────────────────────────────────────────────────────────
// US26 – Stripe Webhook (server-side payment confirmation)
// ─────────────────────────────────────────────────────────────────
export async function handleStripeWebhook(request, response) {
    const sig = request.headers['stripe-signature'];
    // Use CLI webhook secret when testing locally, else use dashboard secret
    const webhookSecret = process.env.STRIPE_CLI_WEBHOOK_SECRET || process.env.STRIPE_ENPOINT_WEBHOOK_SECRET_KEY;

    let event;
    try {
        event = Stripe.webhooks.constructEvent(request.rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message);
        return response.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};

        // --- CASE 1: Booking Deposit ---
        if (metadata.type === 'booking_deposit') {
            const { bookingId } = metadata;
            console.log('🔔 [Stripe Webhook] Processing booking deposit for ID:', bookingId);

            try {
                const booking = await BookingModel.findById(bookingId);
                if (booking) {
                    booking.depositPaid = true;
                    booking.depositStatus = 'paid';
                    booking.depositPaidAt = new Date();
                    booking.stripeDepositPaymentIntentId = session.payment_intent;
                    booking.paymentIntentId = session.payment_intent; // Legacy sync
                    booking.status = 'confirmed'; // Auto confirm on payment
                    await booking.save();
                    console.log('✅ [Stripe Webhook] Booking deposit marked as PAID for:', bookingId);
                } else {
                    console.warn('⚠️ [Stripe Webhook] Booking not found:', bookingId);
                }
            } catch (err) {
                console.error('[Stripe Webhook] Error updating booking:', err);
            }
            return response.status(200).json({ received: true });
        }

        // --- CASE 2: Dine-in Table Order ---
        const { orderType, tableOrderId } = metadata;

        // Only handle dine-in orders
        if (orderType !== 'dine_in' || !tableOrderId) {
            return response.status(200).json({ received: true });
        }

        try {
            const tableOrder = await TableOrderModel.findById(tableOrderId);

            if (!tableOrder) {
                console.error('[Stripe Webhook] TableOrder not found:', tableOrderId);
                return response.status(200).json({ received: true }); // Ack to Stripe
            }

            // Idempotency: already Closed
            if (tableOrder.status === 'Closed') {
                return response.status(200).json({ received: true });
            }

            // AC 9.1 – Bill integrity check
            if (tableOrder.expectedTotal !== null &&
                Math.round(tableOrder.total) !== Math.round(tableOrder.expectedTotal)) {
                console.warn(
                    `[Stripe Webhook] Bill changed for order ${tableOrderId}: ` +
                    `expected ${tableOrder.expectedTotal}, current ${tableOrder.total}`
                );
                tableOrder.billChangedAfterPayment = true;
                await tableOrder.save();
                return response.status(200).json({ received: true });
            }

            // MongoDB transaction: create OrderModel records + mark paid
            const dbSession = await mongoose.startSession();
            try {
                await dbSession.withTransaction(async () => {
                    // tableOrder IS the canonical order — không tạo bản sao OrderModel
                    tableOrder.status = 'Closed';
                    tableOrder.paymentStatus = 'paid';
                    tableOrder.paymentMethod = 'online';
                    tableOrder.paidAt = new Date();

                    // Trừ điểm thưởng nếu khách hàng có sử dụng để giảm giá hóa đơn
                    if (tableOrder.pointsUsed > 0 && tableOrder.userId) {
                        await UserModel.findByIdAndUpdate(
                            tableOrder.userId,
                            { $inc: { rewardsPoint: -tableOrder.pointsUsed } },
                            { session: dbSession }
                        );
                    }

                    // Tích điểm thưởng mới dựa trên tổng tiền thanh toán thực tế
                    if (tableOrder.userId) {
                        const earned = await processLoyaltyPoints(tableOrder.userId, tableOrder.total, dbSession);
                        tableOrder.rewardPointsEarned = earned;
                    }

                    await tableOrder.save({ session: dbSession });
                });

                console.log(`[Stripe Webhook] ✅ Order ${tableOrderId} marked paid (table ${tableOrder.tableNumber})`);

                // AC 11 – Notify Cashier Dashboard via Socket.io
                const io = request.app.get('io');
                if (io) {
                    io.emit('cashier:order_paid_online', {
                        tableOrderId: tableOrder._id.toString(),
                        tableNumber: tableOrder.tableNumber,
                        total: tableOrder.total,
                        paidAt: tableOrder.paidAt
                    });
                }
            } finally {
                await dbSession.endSession();
            }
        } catch (error) {
            console.error('[Stripe Webhook] Error processing payment:', error);
            return response.status(500).json({ error: 'Internal server error' });
        }
    }

    return response.status(200).json({ received: true });
}

// ─────────────────────────────────────────────────────────────────
// US26 – Verify Stripe Session (for success page)
// ─────────────────────────────────────────────────────────────────
export async function verifyStripeSession(request, response) {
    try {
        const { session_id } = request.query;

        if (!session_id) {
            return response.status(400).json({
                message: 'session_id là bắt buộc',
                error: true, success: false
            });
        }

        // Look up by stripeSessionId
        const tableOrder = await TableOrderModel.findOne({ stripeSessionId: session_id });

        if (!tableOrder) {
            // Fallback: try fetching from Stripe API
            try {
                const stripeSession = await Stripe.checkout.sessions.retrieve(session_id);
                const { payment_status } = stripeSession;
                return response.status(200).json({
                    message: payment_status === 'paid' ? 'Đang xử lý...' : 'Chưa thanh toán',
                    error: false,
                    success: true,
                    data: { status: payment_status === 'paid' ? 'processing' : 'pending' }
                });
            } catch {
                return response.status(404).json({
                    message: 'Không tìm thấy phiên thanh toán',
                    error: true, success: false
                });
            }
        }

        // AC 9.1 – bill changed
        if (tableOrder.billChangedAfterPayment) {
            return response.status(200).json({
                message: 'Đơn hàng đã thay đổi. Vui lòng thanh toán lại.',
                error: false,
                success: true,
                data: { status: 'bill_changed', tableNumber: tableOrder.tableNumber }
            });
        }

        // AC 12 – success
        if (tableOrder.status === 'paid') {
            return response.status(200).json({
                message: 'Thanh toán thành công. Cảm ơn quý khách!',
                error: false,
                success: true,
                data: {
                    status: 'paid',
                    tableNumber: tableOrder.tableNumber,
                    total: tableOrder.total,
                    paidAt: tableOrder.paidAt,
                    items: tableOrder.items
                }
            });
        }

        // Still pending (webhook not yet received)
        return response.status(200).json({
            message: 'Đang chờ xác nhận thanh toán...',
            error: false,
            success: true,
            data: { status: 'pending', tableNumber: tableOrder.tableNumber }
        });

    } catch (error) {
        console.error('[verifyStripeSession] Error:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi server',
            error: true, success: false
        });
    }
}

// ─────────────────────────────────────────────────────────────────
// PB29 – Apply Voucher to TableOrder (Cashier applies discount)
// ─────────────────────────────────────────────────────────────────
export async function applyVoucherToTableOrder(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({
                message: 'Không có quyền thực hiện',
                error: true, success: false
            });
        }

        const { id } = request.params;
        const { voucherCode } = request.body;

        if (!voucherCode || !voucherCode.trim()) {
            return response.status(400).json({
                message: 'Vui lòng nhập mã giảm giá',
                error: true, success: false
            });
        }

        const tableOrder = await TableOrderModel.findById(id);
        if (!tableOrder) {
            return response.status(404).json({
                message: 'Không tìm thấy hóa đơn',
                error: true, success: false
            });
        }

        if (tableOrder.status !== 'pending_payment') {
            return response.status(400).json({
                message: 'Hóa đơn không ở trạng thái chờ thanh toán',
                error: true, success: false
            });
        }

        // Find voucher
        const voucher = await VoucherModel.findOne({ code: voucherCode.trim().toUpperCase() });

        if (!voucher) {
            return response.status(404).json({
                message: 'Mã giảm giá không tồn tại',
                error: true, success: false
            });
        }

        if (!voucher.isActive) {
            return response.status(400).json({
                message: 'Mã giảm giá đã bị vô hiệu hóa',
                error: true, success: false
            });
        }

        const currentDate = new Date();
        if (voucher.startDate && new Date(voucher.startDate) > currentDate) {
            return response.status(400).json({
                message: 'Mã giảm giá chưa đến thời gian áp dụng',
                error: true, success: false
            });
        }

        if (voucher.endDate && new Date(voucher.endDate) < currentDate) {
            return response.status(400).json({
                message: 'Mã giảm giá đã hết hạn',
                error: true, success: false
            });
        }

        // Check usage limit
        if (voucher.usageLimit !== null && voucher.usageLimit !== -1 &&
            voucher.usageCount >= voucher.usageLimit) {
            return response.status(400).json({
                message: 'Mã giảm giá đã hết lượt sử dụng',
                error: true, success: false
            });
        }

        const subTotal = tableOrder.subTotal;

        if (subTotal < (voucher.minOrderValue || 0)) {
            return response.status(400).json({
                message: `Đơn hàng tối thiểu ${(voucher.minOrderValue || 0).toLocaleString('vi-VN')}đ để áp dụng mã này`,
                error: true, success: false
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (voucher.discountType === 'percentage') {
            const raw = (subTotal * voucher.discountValue) / 100;
            discountAmount = voucher.maxDiscount ? Math.min(raw, voucher.maxDiscount) : raw;
        } else if (voucher.discountType === 'fixed') {
            discountAmount = Math.min(voucher.discountValue, subTotal);
            discount = Math.min(voucher.discountValue, subTotal);
        }
        discount = Math.round(discount);

        // Áp dụng giảm giá voucher
        tableOrder.discount = discount;
        tableOrder.voucherId = voucher._id;

        // Tính lại tổng tiền: subTotal - voucherDiscount - pointsDiscount
        const pointsDiscount = tableOrder.pointsDiscount || 0;
        tableOrder.total = Math.max(0, subTotal - discount - pointsDiscount);

        await tableOrder.save();

        return response.status(200).json({
            message: 'Áp dụng mã giảm giá thành công',
            error: false,
            success: true,
            data: {
                voucherCode: voucher.code,
                voucherName: voucher.name,
                discountType: voucher.discountType,
                discountValue: voucher.discountValue,
                discountAmount,
                subTotal,
                newTotal,
                maxDiscount: voucher.maxDiscount || null
            }
        });

    } catch (error) {
        console.error('[applyVoucherToTableOrder] Error:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi server',
            error: true, success: false
        });
    }
}

// ─────────────────────────────────────────────────────────────────
// PB29 – Remove Voucher from TableOrder (Cashier clears discount)
// ─────────────────────────────────────────────────────────────────
export async function removeVoucherFromTableOrder(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({
                message: 'Không có quyền thực hiện',
                error: true, success: false
            });
        }

        const { id } = request.params;
        const tableOrder = await TableOrderModel.findById(id);

        if (!tableOrder) {
            return response.status(404).json({
                message: 'Không tìm thấy hóa đơn',
                error: true, success: false
            });
        }

        if (tableOrder.status !== 'pending_payment') {
            return response.status(400).json({
                message: 'Hóa đơn không ở trạng thái chờ thanh toán',
                error: true, success: false
            });
        }

        // Reset voucher discount
        tableOrder.discount = 0;
        tableOrder.voucherId = null;

        // Tính lại tổng tiền: subTotal - pointsDiscount (giữ lại phần giảm từ điểm)
        const pointsDiscount = tableOrder.pointsDiscount || 0;
        tableOrder.total = Math.max(0, tableOrder.subTotal - pointsDiscount);

        await tableOrder.save();

        return response.status(200).json({
            message: 'Đã hủy mã giảm giá',
            error: false,
            success: true,
            data: { newTotal: tableOrder.total, subTotal: tableOrder.subTotal }
        });

    } catch (error) {
        console.error('[removeVoucherFromTableOrder] Error:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi server',
            error: true, success: false
        });
    }
}

// ─────────────────────────────────────────────────────────────────
// Loyalty System Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Tính điểm thưởng và cập nhật hạng thành viên
 * @param {String} userId - ID của user (CUSTOMER)
 * @param {Number} totalAmount - Tổng số tiền thanh toán thực tế
 * @param {Session} session - Mongoose session cho transaction
 */
async function processLoyaltyPoints(userId, totalAmount, session) {
    if (!userId) return 0;

    const user = await UserModel.findById(userId).session(session);
    if (!user || user.role !== 'CUSTOMER') return 0;

    // Công thức: Điểm nhận được = (Tổng tiền / 10.000) * hệ số nhân hạng
    const multiplier = user.tierBenefits?.pointsMultiplier || 1.0;
    const earnedPoints = Math.floor((totalAmount / 10000) * multiplier);

    if (earnedPoints <= 0) return 0;

    // Cộng điểm vào tài khoản
    user.rewardsPoint = (user.rewardsPoint || 0) + earnedPoints;

    // Kiểm tra nâng hạng (tierLevel: bronze -> silver -> gold -> platinum)
    // Ngưỡng điểm ví dụ: Silver >= 500, Gold >= 2000, Platinum >= 5000
    const totalPoints = user.rewardsPoint;
    let newTier = user.tierLevel;
    let newMultiplier = multiplier;

    if (totalPoints >= 5000) {
        newTier = 'platinum';
        newMultiplier = 2.0;
    } else if (totalPoints >= 2000) {
        newTier = 'gold';
        newMultiplier = 1.5;
    } else if (totalPoints >= 500) {
        newTier = 'silver';
        newMultiplier = 1.2;
    }

    if (newTier !== user.tierLevel) {
        user.tierLevel = newTier;
        if (!user.tierBenefits) user.tierBenefits = {};
        user.tierBenefits.pointsMultiplier = newMultiplier;
    }

    await user.save({ session });
    return earnedPoints;
}

// ─────────────────────────────────────────────────────────────────
// PB29 – Apply Reward Points to TableOrder
// ─────────────────────────────────────────────────────────────────
export async function applyRewardPointsToTableOrder(request, response) {
    try {
        const user = await UserModel.findById(request.userId);
        if (!user || !['ADMIN', 'CASHIER'].includes(user.role)) {
            return response.status(403).json({
                message: 'Không có quyền thực hiện',
                error: true, success: false
            });
        }

        const { id } = request.params; // tableOrderId
        const { pointsToUse } = request.body;

        if (!pointsToUse || pointsToUse < 1) {
            return response.status(400).json({
                message: 'Số điểm quy đổi không hợp lệ',
                error: true, success: false
            });
        }

        const tableOrder = await TableOrderModel.findById(id);
        if (!tableOrder) {
            return response.status(404).json({
                message: 'Không tìm thấy hóa đơn',
                error: true, success: false
            });
        }

        if (tableOrder.status !== 'pending_payment') {
            return response.status(400).json({
                message: 'Hóa đơn không ở trạng thái chờ thanh toán',
                error: true, success: false
            });
        }

        // Tìm khách hàng sở hữu hóa đơn
        if (!tableOrder.userId) {
            return response.status(400).json({
                message: 'Chỉ khách hàng có tài khoản thành viên mới có thể dùng điểm',
                error: true, success: false
            });
        }

        const customer = await UserModel.findById(tableOrder.userId);
        if (!customer) {
            return response.status(404).json({
                message: 'Không tìm thấy thông tin thành viên của khách hàng',
                error: true, success: false
            });
        }

        if (customer.rewardsPoint < pointsToUse) {
            return response.status(400).json({
                message: `Khách hàng hiện chỉ có ${customer.rewardsPoint} điểm, không đủ để quy đổi`,
                error: true, success: false
            });
        }

        // Quy tắc quy đổi: 1 điểm = 1.000 VNĐ
        const discountFromPoints = pointsToUse * 1000;

        // Ràng buộc: Không giảm quá 50% tổng hóa đơn (để tránh lạm dụng)
        const maxDiscountAllowed = tableOrder.subTotal * 0.5;
        if (discountFromPoints > maxDiscountAllowed) {
            return response.status(400).json({
                message: `Chỉ được dùng tối đa ${Math.floor(maxDiscountAllowed / 1000)} điểm (giảm không quá 50% hóa đơn)`,
                error: true, success: false
            });
        }

        // Áp dụng giảm giá
        tableOrder.pointsUsed = pointsToUse;
        tableOrder.pointsDiscount = discountFromPoints;

        // Tính lại tổng tiền: subTotal - voucherDiscount - pointsDiscount
        const voucherDiscount = tableOrder.discount || 0;
        tableOrder.total = Math.max(0, tableOrder.subTotal - voucherDiscount - discountFromPoints);

        await tableOrder.save();

        return response.status(200).json({
            message: `Đã áp dụng đổi ${pointsToUse} điểm (Giảm ${discountFromPoints.toLocaleString('vi-VN')}đ)`,
            error: false,
            success: true,
            data: {
                pointsUsed: tableOrder.pointsUsed,
                pointsDiscount: tableOrder.pointsDiscount,
                total: tableOrder.total
            }
        });

    } catch (error) {
        console.error('Error applying reward points:', error);
        return response.status(500).json({
            message: error.message || 'Lỗi áp dụng đổi điểm',
            error: true, success: false
        });
    }
}
