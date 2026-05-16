import React from 'react';
import Loading from '../components/Loading';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
    FaTable,
    FaUtensils,
    FaClock,
    FaCoins,
    FaTag,
    FaStar,
} from 'react-icons/fa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DisplayPriceInVND } from '../utils/DisplayPriceInVND';

const ActiveTableOrders = ({ orders, loading }) => {
    if (loading && orders.length === 0) {
        return <Loading />;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {orders.length === 0 ? (
                <div className="col-span-full liquid-glass rounded-xl border-2 border-dashed border-border py-20 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground/30">
                        <FaTable size={32} />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">
                        Hiện không có bàn nào đang gọi món
                    </p>
                </div>
            ) : (
                orders.map((order) => (
                    <Card
                        key={order._id}
                        className="liquid-glass border-2 border-border rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
                    >
                        {/* Table Header */}
                        <CardHeader className="bg-gradient-to-r from-highlight to-highlight_2 p-4 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-white flex items-center gap-2 text-xl font-black uppercase italic tracking-tight">
                                <FaTable />
                                Bàn {order.tableNumber}
                            </CardTitle>
                            <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold border border-white/30 flex items-center gap-2">
                                <FaUtensils size={10} />
                                {order.items.length} món
                            </div>
                        </CardHeader>

                        {/* Items List */}
                        <CardContent className="p-0 flex-1 flex flex-col">
                            <div className="max-h-72 overflow-y-auto custom-scrollbar p-4 flex-1">
                                <ul className="space-y-3">
                                    {order.items.map((item, index) => (
                                        <li
                                            key={index}
                                            className="group flex justify-between items-start bg-muted/20 hover:bg-muted/40 p-3 rounded-lg transition-colors border border-transparent hover:border-highlight/20"
                                        >
                                            <div className="space-y-1">
                                                <p className="font-bold text-foreground text-sm leading-tight group-hover:text-highlight transition-colors">
                                                    {item.name}
                                                </p>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <FaClock className="text-highlight/50" />
                                                    {format(
                                                        new Date(item.addedAt),
                                                        'HH:mm',
                                                        { locale: vi }
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-highlight_2 bg-highlight_2/10 px-2 py-0.5 rounded">
                                                    x{item.quantity}
                                                </span>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    {DisplayPriceInVND(
                                                        item.price
                                                    )}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Summary Footer */}
                            <div className="p-4 bg-muted/10 border-t-2 border-border space-y-2">
                                <div className="space-y-1 text-[13px]">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span className="flex items-center gap-2">
                                            <FaCoins size={10} /> Tạm tính
                                        </span>
                                        <span className="font-medium">
                                            {DisplayPriceInVND(
                                                order.subTotal || order.total
                                            )}
                                        </span>
                                    </div>

                                    {order.discount > 0 && (
                                        <div className="flex justify-between text-green-500 font-medium">
                                            <span className="flex items-center gap-2">
                                                <FaTag size={10} /> Voucher
                                            </span>
                                            <span>
                                                -
                                                {DisplayPriceInVND(
                                                    order.discount
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {order.pointsDiscount > 0 && (
                                        <div className="flex justify-between text-blue-500 font-medium">
                                            <span className="flex items-center gap-2">
                                                <FaStar size={10} /> Điểm thưởng
                                            </span>
                                            <span>
                                                -
                                                {DisplayPriceInVND(
                                                    order.pointsDiscount
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center pt-3 border-t border-border mt-2">
                                    <span className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
                                        Tổng cộng
                                    </span>
                                    <span className="text-2xl font-black text-highlight_2 tracking-tighter drop-shadow-sm">
                                        {DisplayPriceInVND(order.total)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
};

export default ActiveTableOrders;
