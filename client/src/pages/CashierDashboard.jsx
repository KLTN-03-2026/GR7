import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import Axios from '../utils/Axios';
import SummaryApi from '../common/SummaryApi';
import toast from 'react-hot-toast';
import {
    FiRefreshCw,
    FiWifi,
    FiWifiOff,
    FiMaximize,
    FiMinimize,
    FiPrinter,
    FiCheckCircle,
    FiClock,
    FiDollarSign,
    FiTag,
    FiX,
} from 'react-icons/fi';
import { MdOutlinePayment, MdTableRestaurant } from 'react-icons/md';
import { BsBellFill } from 'react-icons/bs';
import { CreditCard, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

// ──────────────────────────────────────────────────────
// VietQR config – BIDV account
// ──────────────────────────────────────────────────────
const VIETQR_BANK = 'BIDV';
const VIETQR_ACCT = '6331102124';
const VIETQR_NAME = 'NGO KIM HOANG NAM';

function buildVietQRUrl(amount, description) {
    const desc = encodeURIComponent(description);
    const name = encodeURIComponent(VIETQR_NAME);
    return `https://img.vietqr.io/image/${VIETQR_BANK}-${VIETQR_ACCT}-compact2.png?amount=${amount}&addInfo=${desc}&accountName=${name}`;
}

// ──────────────────────────────────────────────────────
// Print bill helper
// ──────────────────────────────────────────────────────
function printBill(order) {
    const items = order.items || [];
    const subTotal = order.subTotal || order.total || 0;
    const discount = order.discount || 0;
    const total = order.total || 0;
    const now = format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi });
    const desc = `Thanh toan ban ${order.tableNumber} EatEase`;
    const qrUrl = buildVietQRUrl(total, desc);

    const rows = items
        .map(
            (item) =>
                `<tr>
            <td style="padding:4px 8px">${item.name}</td>
            <td style="padding:4px 8px;text-align:center">x${item.quantity}</td>
            <td style="padding:4px 8px;text-align:right">${(item.price * item.quantity).toLocaleString('vi-VN')}đ</td>
        </tr>`
        )
        .join('');

    const discountRow =
        discount > 0
            ? `<tr><td colspan="2" style="padding:4px 8px;color:#16a34a">Giảm giá:</td><td style="padding:4px 8px;text-align:right;color:#16a34a">-${discount.toLocaleString('vi-VN')}đ</td></tr>`
            : '';

    const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <title>Hóa đơn – Bàn ${order.tableNumber}</title>
        <style>
            body{font-family:'Arial',sans-serif;max-width:320px;margin:0 auto;padding:16px;font-size:13px}
            h2{text-align:center;margin:0 0 4px}
            p.sub{text-align:center;color:#555;margin:0 0 12px;font-size:11px}
            table{width:100%;border-collapse:collapse}
            thead tr{border-bottom:2px solid #333}
            tfoot tr{border-top:2px solid #333}
            .total{font-weight:bold;font-size:15px}
            .qr-section{text-align:center;margin-top:16px;padding-top:12px;border-top:1px dashed #ccc}
            .qr-section img{width:180px;height:180px;object-fit:contain}
            .qr-section p{font-size:11px;color:#555;margin:4px 0 0}
            .footer{text-align:center;margin-top:12px;font-size:11px;color:#777}
        </style></head><body onload="window.print()">
        <h2>🍽️ EatEase Restaurant</h2>
        <p class="sub">Bàn: ${order.tableNumber} &nbsp;|&nbsp; ${now}</p>
        <table>
            <thead><tr>
                <th style="text-align:left;padding:4px 8px">Món</th>
                <th>SL</th>
                <th style="text-align:right">Tiền</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot>
                ${discount > 0 ? `<tr><td colspan="2" style="padding:4px 8px">Tạm tính:</td><td style="text-align:right;padding:4px 8px">${subTotal.toLocaleString('vi-VN')}đ</td></tr>` : ''}
                ${discountRow}
                <tr>
                    <td colspan="2" class="total" style="padding:8px 8px 4px">Tổng cộng:</td>
                    <td class="total" style="text-align:right;padding:8px 8px 4px">${total.toLocaleString('vi-VN')}đ</td>
                </tr>
            </tfoot>
        </table>

        <!-- VietQR Payment -->
        <div class="qr-section">
            <p style="font-weight:bold;font-size:12px;margin-bottom:6px">📱 Quét mã để thanh toán</p>
            <img src="${qrUrl}" alt="VietQR" />
            <p>${VIETQR_BANK} – ${VIETQR_ACCT}</p>
            <p>${VIETQR_NAME}</p>
            <p style="font-weight:bold;color:#e65c00">${total.toLocaleString('vi-VN')}đ</p>
        </div>

        <p class="footer">Cảm ơn quý khách! Hẹn gặp lại 🙏</p>
        </body></html>`;

    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) {
        toast.error('Vui lòng cho phép popup để in hóa đơn.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
}

// ──────────────────────────────────────────────────────
// Main CashierDashboard
// ──────────────────────────────────────────────────────
const CashierDashboard = () => {
    const user = useSelector((s) => s.user);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [clock, setClock] = useState(new Date());
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [confirming, setConfirming] = useState(false);

    // Payment calculator states
    const [customerPaid, setCustomerPaid] = useState('');

    const socketRef = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        document.body.style.overflow = isExpanded ? 'hidden' : 'unset';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isExpanded]);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await Axios({
                ...SummaryApi.get_cashier_pending_orders,
            });
            if (res.data?.success) setOrders(res.data.data || []);
        } catch {
            toast.error('Không thể tải danh sách thanh toán.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
        const s = io(SOCKET_URL);
        socketRef.current = s;
        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));
        s.on('cashier:new_payment_request', (data) => {
            toast(`💳 Bàn ${data.tableNumber} yêu cầu thanh toán!`, {
                icon: <BsBellFill className="text-amber-500" />,
                duration: 8000,
                style: { border: '2px solid #f59e0b' },
            });
            fetchOrders();
        });
        s.on('cashier:order_paid_online', (data) => {
            toast.success(
                `✅ Bàn ${data.tableNumber} vừa thanh toán online thành công! (${(data.total || 0).toLocaleString('vi-VN')}đ)`,
                { duration: 6000 }
            );
            fetchOrders();
        });
        return () => s.disconnect();
    }, [fetchOrders]);

    const handleConfirmPayment = async () => {
        if (!selectedOrder) return;
        setConfirming(true);
        try {
            const res = await Axios({
                ...SummaryApi.cashier_confirm_payment,
                data: { tableOrderId: selectedOrder._id },
            });
            if (res.data?.success) {
                toast.success(
                    'Thanh toán thành công. Đơn hàng đã được hoàn tất.',
                    { duration: 4000 }
                );
                setSelectedOrder(null);
                fetchOrders();
            } else {
                toast.error(res.data?.message || 'Lỗi xác nhận thanh toán.');
            }
        } catch (err) {
            toast.error(
                err?.response?.data?.message || 'Lỗi xác nhận thanh toán.'
            );
        } finally {
            setConfirming(false);
        }
    };

    const totalPending = orders.reduce((s, o) => s + (o.total || 0), 0);

    return (
        <div
            className={`min-h-screen bg-background text-foreground transition-all duration-300 ${
                isExpanded
                    ? 'fixed inset-0 z-[9999] overflow-y-auto w-full h-full'
                    : 'relative'
            }`}
        >
            {/* ── Header ── */}
            <div
                className="border-b-2 border-border px-6 py-4 sticky top-0 z-20 shadow-lg"
                style={{
                    background: 'rgba(var(--card-rgb), 0.8)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-highlight/20"
                            style={{
                                background:
                                    'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                            }}
                        >
                            <MdOutlinePayment className="text-white text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-tight text-highlight">
                                Cashier Dashboard
                            </h1>
                            <p className="text-muted-foreground text-xs font-semibold tracking-wide mt-1 flex items-center gap-2">
                                <span className="uppercase">
                                    {clock.toLocaleString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: '2-digit',
                                    })}
                                </span>
                                <span className="text-border">|</span>
                                <span className="text-highlight font-bold">
                                    {user?.name || 'Nhân viên'}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-8">
                        <div className="text-center group">
                            <div className="flex items-center justify-center gap-2 mb-0.5">
                                <CreditCard className="w-4 h-4 text-highlight" />
                                <p className="text-xl font-bold text-highlight">
                                    {orders.length}
                                </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-highlight transition-colors">
                                Chờ thu tiền
                            </p>
                        </div>
                        <div className="h-8 w-px bg-border/50" />
                        <div className="text-center group">
                            <div className="flex items-center justify-center gap-2 mb-0.5">
                                <Wallet className="w-4 h-4 text-green-500" />
                                <p className="text-xl font-bold text-green-500">
                                    {totalPending.toLocaleString('vi-VN')}
                                    <span className="text-xl font-bold ml-0.5">
                                        đ
                                    </span>
                                </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-highlight transition-colors">
                                Tổng cần thu
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div
                            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border shadow-sm ${
                                connected
                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                    : 'bg-red-500/10 text-red-600 border-red-500/20'
                            }`}
                        >
                            <div
                                className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                            />
                            {connected ? 'Live' : 'Offline'}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsExpanded((p) => !p)}
                                className="flex items-center justify-center bg-card hover:bg-accent border-2 border-border w-10 h-10 rounded-xl transition-all active:scale-90"
                            >
                                {isExpanded ? (
                                    <FiMinimize size={18} />
                                ) : (
                                    <FiMaximize size={18} />
                                )}
                            </button>
                            <button
                                onClick={fetchOrders}
                                className="flex items-center gap-2 bg-card hover:bg-accent border-2 border-border px-3 py-2 h-10 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest active:scale-90"
                            >
                                <FiRefreshCw
                                    size={14}
                                    className={loading ? 'animate-spin' : ''}
                                />
                                <span className="hidden md:inline">
                                    Làm mới
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        <div
                            className="animate-spin rounded-full h-10 w-10 border-b-2 mr-3"
                            style={{ borderColor: '#C96048' }}
                        />
                        Đang tải...
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                        <FiDollarSign className="text-6xl text-green-500" />
                        <p className="text-xl font-semibold text-foreground">
                            Không có đơn nào chờ thanh toán 🎉
                        </p>
                        <p className="text-sm">Tất cả đơn hàng đã được xử lý</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT COLUMN: Danh sách hóa đơn chờ thanh toán */}
                        <div className="lg:col-span-1 flex flex-col">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-highlight/10 rounded-lg text-highlight">
                                        <MdOutlinePayment className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
                                        Chờ thanh toán
                                    </h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-highlight text-white shadow-sm">
                                        {orders.length}
                                    </span>
                                </div>
                            </div>

                            <div
                                className="space-y-3 overflow-y-auto pr-2 custom-scrollbar"
                                style={{ maxHeight: 'calc(100vh - 220px)' }}
                            >
                                {orders.map((order) => {
                                    const itemCount = order.items?.length || 0;
                                    const waitMins = order.checkedOutAt
                                        ? Math.floor(
                                              (Date.now() -
                                                  new Date(
                                                      order.checkedOutAt
                                                  )) /
                                                  60000
                                          )
                                        : null;
                                    const isSelected =
                                        selectedOrder?._id === order._id;

                                    return (
                                        <div
                                            key={order._id}
                                            onClick={() => {
                                                setSelectedOrder(order);
                                            }}
                                            className={`rounded-2xl overflow-hidden border-2 transition-all cursor-pointer active:scale-[0.98] ${
                                                isSelected
                                                    ? 'border-highlight shadow-xl shadow-highlight/10 ring-4 ring-highlight/5'
                                                    : 'border-border hover:border-highlight/30 hover:shadow-lg'
                                            }`}
                                            style={{
                                                background: isSelected
                                                    ? 'linear-gradient(135deg, rgba(201, 96, 72, 0.1) 0%, rgba(217, 122, 102, 0.05) 100%)'
                                                    : 'rgba(var(--card-rgb), 0.8)',
                                                backdropFilter: 'blur(20px)',
                                            }}
                                        >
                                            {/* Card header */}
                                            <div className="px-4 py-3 flex items-center justify-between border-b-2 border-border/50">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-muted rounded-md text-muted-foreground border border-border">
                                                        #
                                                        {order._id
                                                            ?.slice(-4)
                                                            .toUpperCase()}
                                                    </span>
                                                    <h3 className="font-bold text-highlight uppercase tracking-tight flex items-center gap-1.5">
                                                        <MdTableRestaurant className="w-4 h-4" />{' '}
                                                        Bàn {order.tableNumber}
                                                    </h3>
                                                </div>
                                                {waitMins !== null && (
                                                    <span
                                                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-bold uppercase ${
                                                            waitMins > 10
                                                                ? 'bg-red-500 text-white animate-pulse'
                                                                : 'bg-highlight/10 text-highlight'
                                                        }`}
                                                    >
                                                        <FiClock size={10} />{' '}
                                                        {waitMins}P
                                                    </span>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="px-5 py-4 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                        {itemCount} món ăn
                                                    </p>
                                                    <p className="text-2xl font-black text-foreground tracking-tighter mt-1">
                                                        {(
                                                            order.total || 0
                                                        ).toLocaleString(
                                                            'vi-VN'
                                                        )}
                                                        <span className="text-sm ml-0.5">
                                                            đ
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-highlight/5 flex items-center justify-center text-highlight border border-highlight/10 group-hover:bg-highlight group-hover:text-white transition-colors">
                                                    <MdOutlinePayment
                                                        size={20}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Chi tiết đơn hàng + Tóm tắt thanh toán */}
                        <div className="lg:col-span-2 flex flex-col">
                            {!selectedOrder ? (
                                <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] text-muted-foreground gap-5 border-2 border-dashed border-border rounded-[2.5rem] p-12 bg-muted/5">
                                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-2">
                                        <MdOutlinePayment className="text-6xl opacity-20" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-bold text-foreground uppercase tracking-tight">
                                            Chọn hóa đơn chi tiết
                                        </p>
                                        <p className="text-sm mt-2 opacity-60">
                                            Click vào hóa đơn bên trái để bắt
                                            đầu thanh toán
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Chi tiết đơn hàng */}
                                    <div
                                        className="rounded-[2.5rem] border-2 border-border overflow-hidden shadow-2xl shadow-highlight/5"
                                        style={{
                                            background:
                                                'rgba(var(--card-rgb), 0.8)',
                                            backdropFilter: 'blur(20px)',
                                        }}
                                    >
                                        <div
                                            className="px-6 py-5 border-b-2 border-border/50 flex items-center justify-between"
                                            style={{
                                                background:
                                                    'linear-gradient(135deg, rgba(201, 96, 72, 0.1) 0%, rgba(217, 122, 102, 0.05) 100%)',
                                            }}
                                        >
                                            <div>
                                                <h3 className="text-xl font-black uppercase tracking-tight text-highlight leading-tight">
                                                    Bàn{' '}
                                                    {selectedOrder.tableNumber}
                                                </h3>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-highlight" />
                                                    {selectedOrder.items
                                                        ?.length || 0}{' '}
                                                    món ăn đã phục vụ
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold font-mono px-2.5 py-1.5 bg-muted/50 rounded-xl text-muted-foreground border border-border/50 backdrop-blur-sm">
                                                    ID: #
                                                    {selectedOrder._id
                                                        ?.slice(-6)
                                                        .toUpperCase()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Items table */}
                                        <div className="p-6">
                                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {(
                                                    selectedOrder.items || []
                                                ).map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between gap-4 bg-muted/20 hover:bg-muted/30 transition-colors rounded-2xl px-5 py-4 border-2 border-border/50 group/item"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-sm uppercase tracking-tight text-foreground group-hover/item:text-highlight transition-colors">
                                                                {item.name}
                                                            </p>
                                                            {item.note && (
                                                                <p className="text-[10px] font-bold text-highlight italic mt-1.5 flex items-center gap-1.5">
                                                                    <span className="shrink-0">
                                                                        📝
                                                                    </span>
                                                                    {item.note}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right flex items-center gap-4">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                    SL: x
                                                                    {
                                                                        item.quantity
                                                                    }
                                                                </p>
                                                                <p className="text-xs font-bold text-foreground/60 mt-0.5">
                                                                    {item.price.toLocaleString(
                                                                        'vi-VN'
                                                                    )}
                                                                    đ
                                                                </p>
                                                            </div>
                                                            <div className="min-w-[100px] text-right">
                                                                <p className="text-base font-black text-highlight tracking-tighter">
                                                                    {(
                                                                        item.price *
                                                                        item.quantity
                                                                    ).toLocaleString(
                                                                        'vi-VN'
                                                                    )}
                                                                    đ
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tóm tắt thanh toán */}
                                    <div
                                        className="rounded-[2.5rem] border-2 border-border overflow-hidden shadow-2xl shadow-highlight/5"
                                        style={{
                                            background:
                                                'rgba(var(--card-rgb), 0.8)',
                                            backdropFilter: 'blur(20px)',
                                        }}
                                    >
                                        <div
                                            className="px-6 py-5 border-b-2 border-border/50"
                                            style={{
                                                background:
                                                    'linear-gradient(135deg, rgba(201, 96, 72, 0.1) 0%, rgba(217, 122, 102, 0.05) 100%)',
                                            }}
                                        >
                                            <h3 className="text-lg font-black uppercase tracking-tight text-highlight">
                                                Tổng hợp thanh toán
                                            </h3>
                                        </div>

                                        <div className="p-6 space-y-6">
                                            {/* Voucher & Points - Read only */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {selectedOrder.discount > 0 && (
                                                    <div className="flex items-center gap-3 px-4 py-4 rounded-2xl border-2 bg-green-500/5 border-green-500/20 backdrop-blur-sm">
                                                        <div className="p-2 bg-green-500/10 rounded-lg text-green-600">
                                                            <FiTag size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-green-600 opacity-60">
                                                                Voucher
                                                            </p>
                                                            <p className="text-sm font-black text-green-600">
                                                                -
                                                                {(
                                                                    selectedOrder.discount ||
                                                                    0
                                                                ).toLocaleString(
                                                                    'vi-VN'
                                                                )}
                                                                đ
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedOrder.pointsUsed >
                                                    0 && (
                                                    <div className="flex items-center gap-3 px-4 py-4 rounded-2xl border-2 bg-amber-500/5 border-amber-500/20 backdrop-blur-sm">
                                                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                                            <FiDollarSign
                                                                size={16}
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 opacity-60">
                                                                Dùng{' '}
                                                                {
                                                                    selectedOrder.pointsUsed
                                                                }{' '}
                                                                điểm
                                                            </p>
                                                            <p className="text-sm font-black text-amber-600">
                                                                -
                                                                {(
                                                                    selectedOrder.pointsDiscount ||
                                                                    0
                                                                ).toLocaleString(
                                                                    'vi-VN'
                                                                )}
                                                                đ
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Total summary */}
                                            <div className="bg-muted/30 rounded-[2rem] p-6 border-2 border-border/50">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center text-xs font-bold tracking-widest text-muted-foreground">
                                                        <span className="uppercase">
                                                            Tạm tính:
                                                        </span>
                                                        <span className="text-foreground">
                                                            {(
                                                                selectedOrder.subTotal ||
                                                                selectedOrder.total ||
                                                                0
                                                            ).toLocaleString(
                                                                'vi-VN'
                                                            )}
                                                            đ
                                                        </span>
                                                    </div>

                                                    {selectedOrder.discount >
                                                        0 && (
                                                        <div className="flex justify-between items-center text-xs font-bold tracking-widest text-green-600">
                                                            <span className="uppercase">
                                                                Giảm mã Voucher:
                                                            </span>
                                                            <span>
                                                                -
                                                                {(
                                                                    selectedOrder.discount ||
                                                                    0
                                                                ).toLocaleString(
                                                                    'vi-VN'
                                                                )}
                                                                đ
                                                            </span>
                                                        </div>
                                                    )}

                                                    {selectedOrder.pointsDiscount >
                                                        0 && (
                                                        <div className="flex justify-between items-center text-xs font-bold tracking-widest text-amber-600">
                                                            <span className="uppercase">
                                                                Giảm điểm
                                                                thưởng:
                                                            </span>
                                                            <span>
                                                                -
                                                                {(
                                                                    selectedOrder.pointsDiscount ||
                                                                    0
                                                                ).toLocaleString(
                                                                    'vi-VN'
                                                                )}
                                                                đ
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-4 pt-4 border-t-2 border-border/50 flex justify-between items-end">
                                                    <div>
                                                        <p className="text-sm font-black uppercase text-muted-foreground mb-1">
                                                            Cần thanh toán
                                                        </p>
                                                        {selectedOrder.paymentMethod ===
                                                            'online' && (
                                                            <h4 className="text-sm font-bold text-green-600 italic">
                                                                💳 Đã thanh toán
                                                                Online
                                                            </h4>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-3xl font-black tracking-tighter text-highlight">
                                                            {(
                                                                selectedOrder.total ||
                                                                0
                                                            ).toLocaleString(
                                                                'vi-VN'
                                                            )}
                                                            đ
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment support (Optional calculator) */}
                                            <div className="pt-6 border-t-2 border-border/50 space-y-4">
                                                <label className="text-sm font-black uppercase text-muted-foreground block">
                                                    Hỗ trợ tính tiền thừa (nếu
                                                    trả tiền mặt)
                                                </label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                                    <div className="relative group/input">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within/input:text-highlight transition-colors">
                                                            <FiDollarSign
                                                                size={20}
                                                            />
                                                        </div>
                                                        <input
                                                            type="number"
                                                            value={customerPaid}
                                                            onChange={(e) =>
                                                                setCustomerPaid(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Nhập số tiền nhận được..."
                                                            className="w-full h-full pl-12 no-spinner pr-4 py-4 border-2 border-border rounded-2xl focus:outline-none focus:border-highlight focus:ring-4 focus:ring-highlight/5 bg-muted/20
                                                            text-foreground text-lg font-black tracking-tight transition-all uppercase"
                                                        />
                                                    </div>

                                                    <div className="flex">
                                                        {customerPaid &&
                                                        parseFloat(
                                                            customerPaid
                                                        ) >=
                                                            (selectedOrder.total ||
                                                                0) ? (
                                                            <div className="w-full rounded-2xl p-3 px-6 border-2 border-green-500/20 bg-green-500/5 backdrop-blur-md animate-in slide-in-from-right-4 duration-300 flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-[12px] font-black uppercase tracking-widest text-green-600 opacity-60 mb-2">
                                                                        Tiền
                                                                        thừa trả
                                                                        khách
                                                                    </p>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xl font-black text-green-600 tracking-tighter leading-none">
                                                                            {(
                                                                                parseFloat(
                                                                                    customerPaid
                                                                                ) -
                                                                                (selectedOrder.total ||
                                                                                    0)
                                                                            ).toLocaleString(
                                                                                'vi-VN'
                                                                            )}
                                                                            <span className="text-xl ml-1 font-black">
                                                                                đ
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="p-2 bg-green-500 text-white rounded-lg shadow-lg shadow-green-500/20">
                                                                    <FiCheckCircle
                                                                        size={
                                                                            20
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full rounded-2xl p-5 border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-sm uppercase font-bold text-center">
                                                                Hỗ trợ tính tiền
                                                                thừa
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex gap-4 pt-6">
                                                <button
                                                    onClick={() =>
                                                        printBill(selectedOrder)
                                                    }
                                                    className="flex-1 flex items-center justify-center gap-3 bg-muted/50 hover:bg-muted text-foreground py-4 rounded-2xl font-black uppercase text-sm transition-all border-2 border-border/50 active:scale-[0.98] shadow-sm"
                                                >
                                                    <FiPrinter size={18} /> In
                                                    hóa đơn
                                                </button>
                                                <button
                                                    onClick={
                                                        handleConfirmPayment
                                                    }
                                                    disabled={confirming}
                                                    className="flex-[1.5] flex items-center justify-center gap-3 text-white py-4 rounded-2xl font-black uppercase text-sm transition-all disabled:opacity-60 active:scale-[0.98] shadow-xl shadow-highlight/20"
                                                    style={{
                                                        background: confirming
                                                            ? 'rgba(201, 96, 72, 0.6)'
                                                            : 'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                                                    }}
                                                >
                                                    <FiCheckCircle size={18} />
                                                    {confirming
                                                        ? 'Đang xử lý...'
                                                        : 'Xác nhận thu tiền'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(201, 96, 72, 0.3);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(201, 96, 72, 0.5);
                }
            `}</style>
        </div>
    );
};

export default CashierDashboard;
