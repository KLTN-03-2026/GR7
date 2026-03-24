import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import Axios from '../utils/Axios';
import SummaryApi from '../common/SummaryApi';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiRefreshCw, FiClock, FiWifi, FiWifiOff, FiBell, FiX } from 'react-icons/fi';
import { MdTableRestaurant } from 'react-icons/md';
import { BsBellFill } from 'react-icons/bs';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

function playChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [523, 659, 784].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.4);
        });
    } catch { /* no-op */ }
}

export default function WaiterBoardPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [servingId, setServingId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [clock, setClock] = useState(new Date());
    const [serviceRequests, setServiceRequests] = useState([]);
    const [handlingId, setHandlingId] = useState(null);
    const [tableOrders, setTableOrders] = useState([]);
    const [cancelingId, setCancelingId] = useState(null);
    const socketRef = useRef(null);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchReadyItems = useCallback(async () => {
        try {
            const res = await Axios({ url: '/api/kitchen/waiter', method: 'GET' });
            if (res.data?.success) setItems(res.data.data);
        } catch {
            toast.error('Không thể tải danh sách món sẵn sàng.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchServiceRequests = useCallback(async () => {
        try {
            const res = await Axios({ ...SummaryApi.get_pending_service_requests });
            if (res.data?.success) setServiceRequests(res.data.data || []);
        } catch { /* silent */ }
    }, []);

    const fetchTableOrders = useCallback(async () => {
        try {
            const res = await Axios({ ...SummaryApi.get_all_active_table_orders });
            if (res.data?.success) setTableOrders(res.data.data || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchReadyItems();
        fetchServiceRequests();
        fetchTableOrders();

        const s = io(SOCKET_URL);
        socketRef.current = s;
        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));
        s.emit('waiter:join');

        s.on('dish:ready', (data) => {
            playChime();
            toast(`🍽️ Bàn ${data.tableName} – "${data.productName}" sẵn sàng phục vụ!`, {
                icon: <BsBellFill className="text-amber-500" />,
                duration: 8000,
                style: { border: '2px solid #f59e0b' },
            });
            fetchReadyItems();
        });

        s.on('dish:served', () => fetchReadyItems());

        s.on('waiter:service_request', (data) => {
            playChime();
            toast(`🔔 Bàn ${data.tableNumber} gọi phục vụ${data.note ? ': "' + data.note + '"' : ''}`, {
                icon: <FiBell className="text-orange-500" />,
                duration: 10000,
                style: { border: '2px solid #f97316' },
            });
            setServiceRequests((prev) => [data, ...prev]);
        });

        s.on('waiter:service_request_updated', (data) => {
            setServiceRequests((prev) => prev.filter((r) => r._id !== data._id));
        });

        // Refresh table orders khi có đơn mới hoặc khi món được phục vụ
        s.on('kitchen:new_order', () => fetchTableOrders());
        s.on('dish:served', () => { fetchReadyItems(); fetchTableOrders(); });

        return () => s.disconnect();
    }, [fetchReadyItems, fetchServiceRequests, fetchTableOrders]);

    const markServed = async (orderId, itemId) => {
        setServingId(itemId);
        try {
            await Axios({
                url: `/api/kitchen/item/${orderId}/${itemId}/served`,
                method: 'PATCH',
            });
            setItems((prev) => prev.filter((item) => item._id !== itemId));
            toast.success('Đã phục vụ món! ✅');
        } catch {
            toast.error('Cập nhật thất bại.');
        } finally {
            setServingId(null);
        }
    };

    const handleServiceRequest = async (id, status) => {
        setHandlingId(id);
        try {
            await Axios({
                url: `/api/service-request/${id}/handle`,
                method: 'PATCH',
                data: { status },
            });
            setServiceRequests((prev) => prev.filter((r) => r._id !== id));
            toast.success(status === 'done' ? 'Đã xử lý yêu cầu ✅' : 'Đã cập nhật yêu cầu');
        } catch {
            toast.error('Không thể cập nhật yêu cầu.');
        } finally {
            setHandlingId(null);
        }
    };

    const cancelItem = async (orderId, itemId, itemName) => {
        if (!window.confirm(`Xác nhận huỷ món "${itemName}"?`)) return;
        setCancelingId(itemId);
        try {
            await Axios({
                url: `/api/table-order/item/${orderId}/${itemId}`,
                method: 'DELETE',
            });
            toast.success(`Đã huỷ món "${itemName}" ✅`);
            fetchTableOrders();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Không thể huỷ món.');
        } finally {
            setCancelingId(null);
        }
    };

    // Build tableId → tableNumber map từ tableOrders đã có (tránh fetch thêm)
    const tableIdToNumber = tableOrders.reduce((map, order) => {
        if (order.tableId && order.tableNumber) map[order.tableId] = order.tableNumber;
        return map;
    }, {});

    // Group ready-items by table (resolve tableNumber from map)
    const grouped = items.reduce((acc, item) => {
        const rawId = typeof item.tableId === 'object' ? item.tableId?._id : item.tableId;
        const key = tableIdToNumber[rawId]
            || item.tableId?.tableNumber
            || item.tableId?.name
            || rawId
            || 'Không rõ';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-amber-950 text-white">
            {/* Header */}
            <div className="bg-amber-900/80 border-b border-amber-800 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <MdTableRestaurant className="text-amber-400 text-3xl" />
                        <div>
                            <h1 className="text-xl font-bold leading-none">Waiter Board</h1>
                            <p className="text-amber-300/60 text-xs mt-0.5">
                                {clock.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-amber-300">{items.length}</p>
                            <p className="text-xs text-amber-500">Chờ phục vụ</p>
                        </div>
                        <div className="h-8 w-px bg-amber-800" />
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{Object.keys(grouped).length}</p>
                            <p className="text-xs text-amber-500">Bàn</p>
                        </div>
                        {serviceRequests.length > 0 && (
                            <>
                                <div className="h-8 w-px bg-amber-800" />
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-orange-400 animate-bounce">{serviceRequests.length}</p>
                                    <p className="text-xs text-orange-500">Gọi phục vụ</p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                            {connected ? <FiWifi size={12} /> : <FiWifiOff size={12} />}
                            {connected ? 'Real-time' : 'Offline'}
                        </div>
                        <button
                            onClick={() => { fetchReadyItems(); fetchServiceRequests(); }}
                            className="flex items-center gap-2 bg-amber-800 hover:bg-amber-700 px-3 py-2 rounded-xl transition text-sm"
                        >
                            <FiRefreshCw size={14} /> Làm mới
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-screen-xl mx-auto p-6 space-y-8">

                {/* Service Requests Panel */}
                {serviceRequests.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-orange-400 mb-3 flex items-center gap-2">
                            <FiBell className="animate-bounce" /> Yêu cầu gọi phục vụ ({serviceRequests.length})
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {serviceRequests.map((req) => (
                                <div key={req._id} className="bg-orange-900/40 border border-orange-600/60 rounded-2xl p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-bold text-orange-300 text-base">🔔 Bàn {req.tableNumber}</p>
                                            <p className="text-xs text-orange-400/70 mt-0.5">
                                                {req.type === 'cancel_item' ? 'Muốn huỷ món' : req.type === 'assistance' ? 'Cần hỗ trợ' : 'Khác'}
                                            </p>
                                        </div>
                                        <span className="text-xs text-orange-500/60">
                                            {new Date(req.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {req.note && (
                                        <p className="text-sm text-white/80 bg-orange-950/50 rounded-lg px-3 py-2 italic">"{req.note}"</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleServiceRequest(req._id, 'done')}
                                            disabled={handlingId === req._id}
                                            className="flex-1 flex items-center justify-center gap-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                                        >
                                            <FiCheckCircle size={14} /> Đã xử lý
                                        </button>
                                        <button
                                            onClick={() => handleServiceRequest(req._id, 'rejected')}
                                            disabled={handlingId === req._id}
                                            className="flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-xl text-sm transition disabled:opacity-60"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* === TẤT CẢ ĐƠN THEO BÀN (Cancel pending items) === */}
                {tableOrders.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
                            <MdTableRestaurant /> Đơn đang chạy ({tableOrders.length} bàn)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {tableOrders.map((order) => (
                                <div key={order._id} className="bg-amber-900/30 border border-amber-700/50 rounded-2xl overflow-hidden">
                                    {/* Table header */}
                                    <div className="bg-amber-900/50 px-4 py-3 flex items-center justify-between">
                                        <h3 className="font-bold text-amber-300">🪑 Bàn {order.tableNumber}</h3>
                                        <span className="text-xs text-amber-500">{order.items.length} món</span>
                                    </div>
                                    {/* Items */}
                                    <div className="p-3 space-y-2">
                                        {order.items.map((item) => {
                                            const isPending = item.kitchenStatus === 'pending';
                                            const statusLabel = {
                                                pending: { text: 'Chờ bếp', cls: 'bg-yellow-900/60 text-yellow-300' },
                                                cooking: { text: 'Đang nấu', cls: 'bg-blue-900/60 text-blue-300' },
                                                ready:   { text: 'Xong', cls: 'bg-green-900/60 text-green-300' },
                                                served:  { text: 'Đã phục vụ', cls: 'bg-gray-700 text-gray-300' },
                                            }[item.kitchenStatus] || { text: item.kitchenStatus, cls: 'bg-gray-700 text-gray-300' };
                                            return (
                                                <div key={item._id} className="flex items-center justify-between gap-2 bg-amber-950/40 rounded-xl px-3 py-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{item.name}</p>
                                                        <p className="text-xs text-amber-500/70">x{item.quantity} · {item.price.toLocaleString('vi-VN')}đ</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusLabel.cls}`}>
                                                        {statusLabel.text}
                                                    </span>
                                                    {isPending && (
                                                        <button
                                                            onClick={() => cancelItem(order._id, item._id, item.name)}
                                                            disabled={cancelingId === item._id}
                                                            className="flex items-center gap-1 bg-red-800/70 hover:bg-red-700 text-red-200 px-2 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            <FiX size={12} /> Huỷ
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* === MÓN SẴN SÀNG PHỤC VỤ === */}
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-amber-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400 mr-3" />
                        Đang tải...
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-amber-400/60 gap-3">
                        <FiCheckCircle className="text-6xl text-green-400" />
                        <p className="text-xl">Tất cả món đã được phục vụ 🎉</p>
                        <p className="text-sm">Không có món nào đang chờ.</p>
                    </div>
                ) : (
                    <>
                        {/* Group by table */}
                        {Object.entries(grouped).map(([tableName, tableItems]) => (
                            <div key={tableName} className="mb-8">
                                <h2 className="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
                                    <MdTableRestaurant className="text-amber-400" />
                                    Bàn {tableName}
                                    <span className="text-sm font-normal text-amber-500 ml-1">({tableItems.length} món)</span>
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {tableItems.map((item) => {
                                        const readyMinutes = item.readyAt
                                            ? Math.floor((Date.now() - new Date(item.readyAt)) / 60000)
                                            : null;
                                        const isUrgent = readyMinutes !== null && readyMinutes >= 5;
                                        return (
                                            <div
                                                key={item._id}
                                                className={`rounded-2xl p-5 flex flex-col gap-4 transition border ${
                                                    isUrgent
                                                        ? 'bg-red-900/30 border-red-600 animate-pulse'
                                                        : 'bg-amber-900/40 border-amber-700 hover:border-amber-500'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-lg font-bold mt-1">
                                                            {item.product?.name || 'Món ăn'}
                                                        </p>
                                                        <p className="text-amber-300/70 text-sm">x{item.quantity}</p>
                                                    </div>
                                                    <div className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/40 whitespace-nowrap">
                                                        Sẵn sàng ✓
                                                    </div>
                                                </div>

                                                {readyMinutes !== null && (
                                                    <p className={`text-xs flex items-center gap-1 ${isUrgent ? 'text-red-400 font-semibold' : 'text-amber-400/70'}`}>
                                                        <FiClock size={12} />
                                                        {isUrgent ? `⚠️ Đã chờ ${readyMinutes} phút!` : `Xong lúc ${new Date(item.readyAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                                                    </p>
                                                )}

                                                <button
                                                    onClick={() => markServed(item.orderId, item._id)}
                                                    disabled={servingId === item._id}
                                                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-60"
                                                >
                                                    <FiCheckCircle />
                                                    {servingId === item._id ? 'Đang xử lý...' : 'Đã phục vụ'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
