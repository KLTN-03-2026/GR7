import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import Axios from '../utils/Axios';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import {
    FiClock,
    FiCheckCircle,
    FiRefreshCw,
    FiWifi,
    FiWifiOff,
    FiMaximize,
    FiMinimize,
    FiCheck,
    FiX,
} from 'react-icons/fi';
import { GiCookingPot } from 'react-icons/gi';
import { BsBellFill } from 'react-icons/bs';
import { MdOutlineRestaurantMenu } from 'react-icons/md';
import { Clock, Flame, CheckCircle2 } from 'lucide-react';
import { FaSearch } from 'react-icons/fa';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

const STATUS_CONFIG = {
    pending: {
        label: 'Chờ chế biến',
        shortLabel: 'Chờ chế biến',
        icon: Clock,
        color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700',
        badgeColor: 'bg-highlight_2',
        dot: 'bg-highlight',
        next: 'cooking',
        nextLabel: 'Bắt đầu nấu',
        buttonColor:
            'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20',
    },
    cooking: {
        label: 'Đang thực hiện',
        shortLabel: 'Đang nấu',
        icon: Flame,
        color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700',
        badgeColor: 'bg-blue-500',
        dot: 'bg-blue-500',
        next: 'ready',
        nextLabel: 'Đánh dấu xong',
        buttonColor:
            'bg-green-600 hover:bg-green-500 shadow-md shadow-green-500/20',
    },
    ready: {
        label: 'Sẵn sàng phục vụ',
        shortLabel: 'Sẵn sàng',
        icon: CheckCircle2,
        color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700',
        badgeColor: 'bg-green-500',
        dot: 'bg-green-500',
        next: null,
        nextLabel: null,
        buttonColor: '',
    },
};

// Beep sound for new order notification
function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    } catch {
        // ignore if no audio context
    }
}

const ChefDashboard = () => {
    const user = useSelector((state) => state?.user);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [clock, setClock] = useState(new Date());
    const [updatingId, setUpdatingId] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [tablesMap, setTablesMap] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTables, setExpandedTables] = useState(new Set());
    const socketRef = useRef(null);

    useEffect(() => {
        const interval = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Manage body scroll when expanded
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isExpanded]);

    const fetchTables = useCallback(async () => {
        try {
            const res = await Axios({
                url: '/api/table/get-all',
                method: 'GET',
            });
            if (res.data?.success) {
                const map = {};
                res.data.data.forEach((t) => {
                    map[t._id] = t.tableNumber;
                });
                setTablesMap(map);
            }
        } catch (err) {
            console.warn('Failed to fetch tables for mapping:', err);
        }
    }, []);

    const toggleExpanded = () => {
        setIsExpanded((prev) => !prev);
    };

    const fetchItems = useCallback(async () => {
        try {
            const res = await Axios({
                url: '/api/kitchen/active',
                method: 'GET',
            });
            if (res.data?.success) setItems(res.data.data);
        } catch {
            toast.error('Không thể tải danh sách món.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
        fetchTables();

        const s = io(SOCKET_URL);
        socketRef.current = s;

        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));
        s.emit('kitchen:join');

        s.on('kitchen:new_order', (data) => {
            playBeep();
            toast(`🔔 Bàn ${data.tableName} – Đơn mới vào bếp!`, {
                icon: <BsBellFill className="text-orange-500" />,
                duration: 6000,
                style: { border: '2px solid #f97316' },
            });
            fetchItems();
        });

        s.on('dish:served', () => fetchItems());

        return () => s.disconnect();
    }, [fetchItems, fetchTables]);

    const updateStatus = async (orderId, itemId, newStatus) => {
        setUpdatingId(itemId);
        try {
            await Axios({
                url: `/api/kitchen/item/${orderId}/${itemId}/status`,
                method: 'PATCH',
                data: { status: newStatus },
            });
            setItems((prev) =>
                prev.map((item) =>
                    item._id === itemId
                        ? { ...item, kitchenStatus: newStatus }
                        : item
                )
            );
            if (newStatus === 'ready') {
                toast.success('Món xong! Đã thông báo waiter 🛎️');
            }
        } catch {
            toast.error('Cập nhật thất bại.');
        } finally {
            setUpdatingId(null);
        }
    };

    // Group items by status (Kanban columns)
    const itemsByStatus = {
        pending: items.filter((i) => i.kitchenStatus === 'pending'),
        cooking: items.filter((i) => i.kitchenStatus === 'cooking'),
        ready: items.filter((i) => i.kitchenStatus === 'ready'),
    };

    // Group pending items by table with smart sorting
    const pendingByTable = itemsByStatus.pending.reduce((acc, item) => {
        let tableName = 'Không rõ';
        if (item.tableId) {
            if (typeof item.tableId === 'object') {
                tableName =
                    item.tableId.tableNumber ||
                    item.tableId.name ||
                    item.tableId.tableName ||
                    tablesMap[item.tableId._id] ||
                    item.tableId._id;
            } else {
                tableName = tablesMap[item.tableId] || item.tableId;
            }
        }

        if (!acc[tableName]) {
            acc[tableName] = {
                tableName,
                items: [],
                oldestTime: item.sentAt
                    ? new Date(item.sentAt).getTime()
                    : Date.now(),
                totalItems: 0,
            };
        }
        acc[tableName].items.push(item);
        acc[tableName].totalItems++;

        // Track oldest item time for this table
        if (item.sentAt) {
            const itemTime = new Date(item.sentAt).getTime();
            if (itemTime < acc[tableName].oldestTime) {
                acc[tableName].oldestTime = itemTime;
            }
        }

        return acc;
    }, {});

    // Smart sorting: Priority = (wait time weight) + (item count weight)
    const pendingTableGroups = Object.values(pendingByTable).sort((a, b) => {
        const waitA = Math.floor((Date.now() - a.oldestTime) / 60000);
        const waitB = Math.floor((Date.now() - b.oldestTime) / 60000);

        // Priority score: wait time (70%) + item count (30%)
        const scoreA = waitA * 0.7 + a.totalItems * 0.3;
        const scoreB = waitB * 0.7 + b.totalItems * 0.3;

        return scoreB - scoreA; // Higher score = higher priority
    });

    // Filter by search query
    const filteredPendingGroups = searchQuery.trim()
        ? pendingTableGroups.filter((group) =>
              group.tableName.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : pendingTableGroups;

    const hasAutoExpanded = useRef(false);

    // Auto-expand top 3 priority tables on first load
    useEffect(() => {
        if (filteredPendingGroups.length > 0 && !hasAutoExpanded.current) {
            const topTables = new Set(
                filteredPendingGroups.slice(0, 3).map((g) => g.tableName)
            );
            setExpandedTables(topTables);
            hasAutoExpanded.current = true;
        }
    }, [filteredPendingGroups]);

    const toggleTableExpand = (tableName) => {
        setExpandedTables((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(tableName)) {
                newSet.delete(tableName);
            } else {
                newSet.add(tableName);
            }
            return newSet;
        });
    };

    const expandAll = () => {
        setExpandedTables(
            new Set(filteredPendingGroups.map((g) => g.tableName))
        );
    };

    const collapseAll = () => {
        setExpandedTables(new Set());
    };

    // Sort cooking and ready items by wait time (longest wait first)
    const sortedCooking = [...itemsByStatus.cooking].sort((a, b) => {
        const timeA = a.sentAt ? new Date(a.sentAt).getTime() : Date.now();
        const timeB = b.sentAt ? new Date(b.sentAt).getTime() : Date.now();
        return timeA - timeB;
    });

    const sortedReady = [...itemsByStatus.ready].sort((a, b) => {
        const timeA = a.sentAt ? new Date(a.sentAt).getTime() : Date.now();
        const timeB = b.sentAt ? new Date(b.sentAt).getTime() : Date.now();
        return timeA - timeB;
    });

    const totalPending = itemsByStatus.pending.length;
    const totalCooking = itemsByStatus.cooking.length;
    const totalReady = itemsByStatus.ready.length;

    return (
        <div
            className={`h-full bg-background text-foreground transition-all duration-300 animate-in fade-in ${
                isExpanded
                    ? 'fixed inset-0 z-[9999] overflow-y-auto w-full h-full'
                    : 'relative'
            }`}
        >
            {/* Header */}
            <div
                className="bg-card border-b-2 border-border px-4 py-3 sticky top-0 z-10 w-full shadow-md"
                style={{
                    background: 'rgba(var(--card-rgb, 255, 255, 255), 0.9)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <div className="w-full flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-highlight/20"
                            style={{
                                background:
                                    'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                            }}
                        >
                            <GiCookingPot className="text-white text-xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-tight text-highlight">
                                Chef Dashboard
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

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6">
                        <div className="text-center group">
                            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                <Clock className="w-4 h-4 text-highlight" />
                                <p className="text-xl font-bold text-highlight">
                                    {totalPending}
                                </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-highlight transition-colors">
                                Đang chờ
                            </p>
                        </div>
                        <div className="h-6 w-px bg-border/50" />
                        <div className="text-center group">
                            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                <Flame className="w-4 h-4 text-blue-500" />
                                <p className="text-xl font-bold text-blue-500">
                                    {totalCooking}
                                </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-blue-500 transition-colors">
                                Chế biến
                            </p>
                        </div>
                        <div className="h-6 w-px bg-border/50" />
                        <div className="text-center group">
                            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <p className="text-xl font-bold text-green-500">
                                    {totalReady}
                                </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-green-500 transition-colors">
                                Sẵn sàng
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
                                onClick={toggleExpanded}
                                className="flex items-center justify-center liquid-glass hover:bg-accent border-2 border-border w-10 h-10 rounded-xl transition-all active:scale-90"
                            >
                                {isExpanded ? (
                                    <FiMinimize size={18} />
                                ) : (
                                    <FiMaximize size={18} />
                                )}
                            </button>
                            <button
                                onClick={fetchItems}
                                className="flex items-center gap-2 liquid-glass hover:bg-accent border-2 border-border px-3 py-2 h-10 rounded-xl transition-all text-xs font-semibold uppercase tracking-wide active:scale-90"
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

            {/* Content - Kanban Board */}
            <div className="w-full p-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-96 text-muted-foreground gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-highlight border-t-transparent" />
                        <p className="font-bold uppercase tracking-widest text-xs">
                            Đang tải dữ liệu bếp...
                        </p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-muted-foreground gap-4 animate-in zoom-in duration-500">
                        <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                            <FiCheckCircle size={48} />
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold uppercase tracking-tight text-foreground">
                                Bếp đã hoàn tất! 🎉
                            </p>
                            <p className="text-sm font-medium mt-1">
                                Tất cả món ăn đã được phục vụ hoặc chờ xử lý.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Column 1: Chờ chế biến (Pending) */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-highlight/10 rounded-lg text-highlight">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg font-bold uppercase tracking-tight">
                                        {STATUS_CONFIG.pending.label}
                                    </h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-highlight text-white shadow-sm">
                                        {totalPending}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                        placeholder="TÌM BÀN..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border-2 border-border bg-card focus:border-highlight focus:outline-none transition-all"
                                    />
                                    <FaSearch
                                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-highlight transition-colors"
                                        size={14}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={expandAll}
                                        className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-card border-2 border-border hover:border-highlight transition-all"
                                    >
                                        Mở hết
                                    </button>
                                    <button
                                        onClick={collapseAll}
                                        className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-card border-2 border-border hover:border-highlight transition-all"
                                    >
                                        Đóng hết
                                    </button>
                                </div>
                            </div>

                            <div
                                className="overflow-y-auto space-y-4 pr-2 custom-scrollbar"
                                style={{ maxHeight: 'calc(100vh - 320px)' }}
                            >
                                {filteredPendingGroups.map(
                                    (tableGroup, index) => {
                                        const oldestWaitMins = Math.floor(
                                            (Date.now() -
                                                tableGroup.oldestTime) /
                                                60000
                                        );
                                        const isExpanded = expandedTables.has(
                                            tableGroup.tableName
                                        );
                                        const isPriority = index < 3;

                                        return (
                                            <div
                                                key={tableGroup.tableName}
                                                className="space-y-2 animate-in slide-in-from-left-4 duration-300"
                                            >
                                                <button
                                                    onClick={() =>
                                                        toggleTableExpand(
                                                            tableGroup.tableName
                                                        )
                                                    }
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border-2 shadow-sm ${
                                                        isPriority
                                                            ? 'border-highlight/30 bg-highlight/5'
                                                            : 'border-border bg-card'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span
                                                            className={`text-xs transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                                                        >
                                                            ▶
                                                        </span>
                                                        <div className="text-left">
                                                            <p className="text-sm font-bold uppercase text-highlight">
                                                                Bàn{' '}
                                                                {
                                                                    tableGroup.tableName
                                                                }
                                                            </p>
                                                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                                                {
                                                                    tableGroup.totalItems
                                                                }{' '}
                                                                MÓN ĐANG CHỜ
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {oldestWaitMins > 0 && (
                                                        <span
                                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                                                oldestWaitMins >
                                                                15
                                                                    ? 'bg-red-500 text-white animate-pulse'
                                                                    : 'bg-highlight/20 text-highlight'
                                                            }`}
                                                        >
                                                            {oldestWaitMins}{' '}
                                                            PHÚT
                                                        </span>
                                                    )}
                                                </button>

                                                {isExpanded && (
                                                    <div className="space-y-3 pl-4 border-l-2 border-highlight/20 ml-2 py-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        {tableGroup.items.map(
                                                            (item) => (
                                                                <KitchenItemCard
                                                                    key={
                                                                        item._id
                                                                    }
                                                                    item={item}
                                                                    status="pending"
                                                                    onUpdateStatus={
                                                                        updateStatus
                                                                    }
                                                                    isUpdating={
                                                                        updatingId ===
                                                                        item._id
                                                                    }
                                                                    tablesMap={
                                                                        tablesMap
                                                                    }
                                                                    showTableBadge={
                                                                        false
                                                                    }
                                                                />
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        </div>

                        {/* Column 2: Đang thực hiện (Cooking) */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                        <Flame className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg font-bold uppercase tracking-tight">
                                        {STATUS_CONFIG.cooking.label}
                                    </h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white shadow-sm">
                                        {totalCooking}
                                    </span>
                                </div>
                            </div>
                            <div
                                className="overflow-y-auto space-y-4 pr-2 custom-scrollbar"
                                style={{ maxHeight: 'calc(100vh - 320px)' }}
                            >
                                {sortedCooking.map((item) => (
                                    <KitchenItemCard
                                        key={item._id}
                                        item={item}
                                        status="cooking"
                                        onUpdateStatus={updateStatus}
                                        isUpdating={updatingId === item._id}
                                        tablesMap={tablesMap}
                                        showTableBadge={true}
                                    />
                                ))}
                                {totalCooking === 0 && (
                                    <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl text-muted-foreground text-xs font-bold uppercase tracking-widest bg-muted/5">
                                        Trống
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 3: Sẵn sàng phục vụ (Ready) */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg font-bold uppercase tracking-tight">
                                        {STATUS_CONFIG.ready.label}
                                    </h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white shadow-sm">
                                        {totalReady}
                                    </span>
                                </div>
                            </div>
                            <div
                                className="overflow-y-auto space-y-4 pr-2 custom-scrollbar"
                                style={{ maxHeight: 'calc(100vh - 320px)' }}
                            >
                                {sortedReady.map((item) => (
                                    <KitchenItemCard
                                        key={item._id}
                                        item={item}
                                        status="ready"
                                        onUpdateStatus={updateStatus}
                                        isUpdating={updatingId === item._id}
                                        tablesMap={tablesMap}
                                        showTableBadge={true}
                                    />
                                ))}
                                {totalReady === 0 && (
                                    <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl text-muted-foreground text-xs font-bold uppercase tracking-widest bg-muted/5">
                                        Trống
                                    </div>
                                )}
                            </div>
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
                    background: rgba(201, 96, 72, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(201, 96, 72, 0.4);
                }
                .liquid-glass {
                    background: rgba(var(--card-rgb, 255, 255, 255), 0.7);
                    backdrop-filter: blur(10px);
                }
            `}</style>
        </div>
    );
};

// Kitchen Item Card Component
function KitchenItemCard({
    item,
    status,
    onUpdateStatus,
    isUpdating,
    tablesMap,
    showTableBadge = true,
}) {
    const cfg = STATUS_CONFIG[status];
    const waitMinutes = item.sentAt
        ? Math.floor((Date.now() - new Date(item.sentAt)) / 60000)
        : null;

    let tableName = 'Không rõ';
    if (item.tableId) {
        if (typeof item.tableId === 'object') {
            tableName =
                item.tableId.tableNumber ||
                item.tableId.name ||
                item.tableId.tableName ||
                tablesMap[item.tableId._id] ||
                item.tableId._id;
        } else {
            tableName = tablesMap[item.tableId] || item.tableId;
        }
    }

    return (
        <div className="rounded-2xl border-2 border-border overflow-hidden transition-all hover:shadow-xl hover:border-highlight/20 bg-card/95 backdrop-blur-md group animate-in zoom-in-95 duration-300">
            {/* Card Header */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b-2 border-border bg-muted/20">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 bg-muted rounded-md text-muted-foreground border border-border">
                        #{item._id?.slice(-4).toUpperCase()}
                    </span>
                    {showTableBadge && (
                        <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-sm ${cfg.badgeColor}`}
                        >
                            BÀN {tableName}
                        </span>
                    )}
                </div>
                {waitMinutes !== null && (
                    <span
                        className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg ${
                            waitMinutes > 15
                                ? 'bg-red-500 text-white'
                                : 'bg-highlight/10 text-highlight'
                        }`}
                    >
                        <FiClock size={10} />
                        {waitMinutes}P
                    </span>
                )}
            </div>

            {/* Card Body */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                        <h3 className="font-bold text-foreground text-base uppercase leading-tight tracking-tight mb-1 group-hover:text-highlight transition-colors">
                            {item.product?.name || 'Món ăn'}
                        </h3>
                        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <MdOutlineRestaurantMenu
                                    size={12}
                                    className="text-highlight/50"
                                />
                                {item.product?.category?.[0]?.name || 'Menu'}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-bold tracking-tight text-highlight">
                            x{item.quantity}
                        </span>
                    </div>
                </div>

                {/* Special Instructions */}
                {item.note && (
                    <div className="mb-4 p-3 rounded-xl bg-highlight/5 border border-highlight/10 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-highlight/30" />
                        <p className="text-xs font-bold text-highlight italic leading-relaxed flex items-start gap-2">
                            <span className="shrink-0">📝</span>
                            <span>{item.note}</span>
                        </p>
                    </div>
                )}

                {/* Action Button */}
                {cfg.next && (
                    <button
                        onClick={() =>
                            onUpdateStatus(item.orderId, item._id, cfg.next)
                        }
                        disabled={isUpdating}
                        className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all active:scale-95 text-white flex items-center justify-center gap-2 ${cfg.buttonColor}`}
                    >
                        {isUpdating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        ) : (
                            <>
                                {cfg.next === 'cooking' ? (
                                    <Flame size={14} />
                                ) : (
                                    <FiCheck size={14} />
                                )}
                                {cfg.nextLabel}
                            </>
                        )}
                    </button>
                )}

                {status === 'ready' && (
                    <div className="mt-2 py-2 bg-green-500/10 rounded-xl text-center">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-600">
                            <FiCheckCircle size={10} />
                            Đã sẵn sàng
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChefDashboard;
