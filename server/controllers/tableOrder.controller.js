import TableOrderModel from '../models/tableOrder.model.js';
import ProductModel from '../models/product.model.js';
import OrderModel from '../models/order.model.js';
import UserModel from '../models/user.model.js';
import mongoose from 'mongoose';
import Stripe from '../config/stripe.js';

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

            // AC 7.2 – Product must be available (status OR stock = 0 both mean hết hàng)
            const isProductAvailable = product.status === 'available' && product.stock !== 0;
            if (!isProductAvailable) {
                return response.status(400).json({
                    message: `"${product.name}" hiện không khả dụng.`,
                    error: true,
                    success: false
                });
            }

            // AC 7.3 – Qty must not exceed available stock (only when stock is tracked)
            if (product.stock > 0 && qty > product.stock) {
                return response.status(400).json({
                    message: `Số lượng vượt quá số lượng hiện có (còn ${product.stock}).`,
                    error: true,
                    success: false
                });
            }

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

        if (!paymentMethod || !['cash', 'online'].includes(paymentMethod)) {
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

        if (paymentMethod === 'cash') {
            // Cash payment - create orders immediately
            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    const orderItems = tableOrder.items.map(item => ({
                        userId: userId,
                        orderId: `ORD-${new mongoose.Types.ObjectId()}`,
                        productId: item.productId._id || item.productId,
                        product_details: {
                            name: item.name,
                            image: item.productId?.image || []
                        },
                        quantity: item.quantity,
                        payment_status: 'Chờ thanh toán',
                        delivery_address: null,
                        customerContact: null,
                        subTotalAmt: item.price * item.quantity,
                        totalAmt: item.price * item.quantity,
                        status: 'pending',
                        tableNumber: tableOrder.tableNumber,
                        orderType: 'dine_in'
                    }));

                    const newOrders = await OrderModel.insertMany(orderItems, { session });

                    // Mark table order as paid
                    tableOrder.status = 'paid';
                    tableOrder.paymentMethod = 'cash';
                    tableOrder.paidAt = new Date();
                    await tableOrder.save({ session });
                });

                return response.status(200).json({
                    message: 'Thanh toán thành công',
                    error: false,
                    success: true,
                    data: {
                        totalPaid: tableOrder.total,
                        paymentMethod: 'cash'
                    }
                });

            } finally {
                await session.endSession();
            }

        } else {
            // Online payment - create Stripe session
            const line_items = tableOrder.items.map(item => ({
                price_data: {
                    currency: 'vnd',
                    product_data: {
                        name: item.name,
                        metadata: {
                            productId: item.productId.toString()
                        }
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
        if (!user || !['ADMIN', 'MANAGER', 'WAITER', 'CHEF'].includes(user.role)) {
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
