import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    FaChartLine,
    FaCoins,
    FaFileInvoice,
    FaUsers,
    FaCalendarAlt,
    FaArrowRight,
    FaClock,
    FaTable,
} from 'react-icons/fa';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import Axios from '../utils/Axios';
import SummaryApi from '../common/SummaryApi';
import { DisplayPriceInVND } from '../utils/DisplayPriceInVND';
import Loading from '../components/Loading';
import { Line } from 'react-chartjs-2';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
    const user = useSelector((state) => state?.user);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.dashboard_stats,
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading />;

    const chartData = {
        labels:
            stats?.revenueTrend.map((item) =>
                format(new Date(item._id), 'dd/MM')
            ) || [],
        datasets: [
            {
                label: 'Doanh thu (VNĐ)',
                data: stats?.revenueTrend.map((item) => item.dailyTotal) || [],
                borderColor: '#0EA5E9',
                backgroundColor: 'rgba(14, 165, 233, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#0EA5E9',
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => DisplayPriceInVND(context.raw),
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(75, 85, 99, 0.3)' },
                ticks: { color: '#0EA5E9', font: { size: 10 } },
            },
            x: {
                grid: { display: false },
                ticks: { color: '#0EA5E9', font: { size: 10 } },
            },
        },
    };

    const statsCards = [
        {
            label: 'Doanh thu hôm nay',
            value: DisplayPriceInVND(stats?.summary.revenueToday),
            icon: <FaCoins className="h-6 w-6" />,
            color: 'text-highlight_2',
        },
        {
            label: 'Đơn hàng mới',
            value: stats?.summary.ordersToday,
            icon: <FaFileInvoice className="h-6 w-6" />,
            color: 'text-blue-500',
        },
        {
            label: 'Bàn đang hoạt động',
            value: stats?.summary.activeTables,
            icon: <FaTable className="h-6 w-6" />,
            color: 'text-orange-500',
        },
        {
            label: 'Đặt bàn trong ngày',
            value: stats?.summary.bookingsToday,
            icon: <FaCalendarAlt className="h-6 w-6" />,
            color: 'text-purple-500',
        },
    ];

    return (
        <div className="container mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <Card className="py-6 border-card-foreground">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl text-highlight font-bold uppercase flex items-center gap-3">
                            <FaChartLine className="h-6 w-6" />
                            Quản trị hệ thống
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Chào mừng trở lại,{' '}
                            <span className="font-semibold text-foreground">
                                {user?.name}
                            </span>
                            . Đây là tổng quan hệ thống hôm nay.
                        </CardDescription>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-xs liquid-glass px-4 py-2 rounded-lg border border-border">
                        <FaClock className="text-highlight_2" />
                        <span>
                            {format(new Date(), "HH:mm, dd 'tháng' MM, yyyy")}
                        </span>
                    </div>
                </CardHeader>
            </Card>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((card, i) => (
                    <div
                        key={i}
                        className="liquid-glass rounded-lg shadow-md p-4 flex items-center gap-4 hover:scale-[1.02] transition-transform duration-300"
                    >
                        <div
                            className={`p-3 rounded-full border-[3px] liquid-glass ${card.color}`}
                        >
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {card.label}
                            </p>
                            <p className="text-xl font-bold">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <Card className="lg:col-span-2 p-5 rounded-lg border-2 border-border shadow-lg">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-base font-bold text-highlight uppercase flex items-center gap-2">
                            <FaChartLine />
                            Xu hướng doanh thu (7 ngày)
                        </h2>
                    </div>
                    <div className="h-[300px]">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </Card>

                {/* Recent Orders */}
                <Card className="p-5 rounded-lg border-2 border-border shadow-lg">
                    <h2 className="text-base font-bold text-highlight uppercase mb-6">
                        Giao dịch mới nhất
                    </h2>
                    <div className="space-y-4">
                        {stats?.recentOrders.length > 0 ? (
                            stats.recentOrders.map((order, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-highlight/20 text-highlight text-xs font-bold flex items-center justify-center border border-highlight/30">
                                            {order.tableNumber || '??'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">
                                                Bàn {order.tableNumber}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(
                                                    new Date(order.updatedAt),
                                                    {
                                                        addSuffix: true,
                                                        locale: vi,
                                                    }
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-highlight_2">
                                            {DisplayPriceInVND(order.total)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase">
                                            {order.paymentMethod === 'cash'
                                                ? 'Tiền mặt'
                                                : 'Stripe'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-muted-foreground text-sm">
                                Chưa có dữ liệu giao dịch
                            </div>
                        )}
                        <Link
                            to="/dashboard/bill"
                            className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-xs font-bold text-highlight hover:text-highlight_2 transition-colors uppercase tracking-widest"
                        >
                            Xem báo cáo chi tiết
                            <FaArrowRight size={10} />
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AdminDashboard;
