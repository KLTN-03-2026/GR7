import TableOrderModel from "../models/tableOrder.model.js";
import BookingModel from "../models/booking.model.js";
import TableModel from "../models/table.model.js";

export async function getDashboardStats(req, res) {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        
        // 1. Revenue Today
        const revenueToday = await TableOrderModel.aggregate([
            {
                $match: {
                    paymentStatus: 'paid',
                    updatedAt: { $gte: todayStart, $lte: todayEnd }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$total" }
                }
            }
        ]);

        // 2. Orders Today
        const ordersTodayCount = await TableOrderModel.countDocuments({
            createdAt: { $gte: todayStart, $lte: todayEnd }
        });

        // 3. Active Tables
        const activeTablesCount = await TableOrderModel.countDocuments({
            status: 'active'
        });

        // 4. Bookings Today
        const bookingsTodayCount = await BookingModel.countDocuments({
            bookingDate: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['pending', 'confirmed'] }
        });

        // 5. Recent Orders (Last 5 paid)
        const recentOrders = await TableOrderModel.find({ paymentStatus: 'paid' })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('tableNumber total updatedAt paymentMethod');

        // 6. Revenue Trend (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const revenueTrend = await TableOrderModel.aggregate([
            {
                $match: {
                    paymentStatus: 'paid',
                    updatedAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    dailyTotal: { $sum: "$total" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    revenueToday: revenueToday[0]?.total || 0,
                    ordersToday: ordersTodayCount,
                    activeTables: activeTablesCount,
                    bookingsToday: bookingsTodayCount
                },
                recentOrders,
                revenueTrend
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
}
