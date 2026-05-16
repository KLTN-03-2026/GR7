import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';
import Axios from '../utils/Axios';
import SummaryApi from '../common/SummaryApi';
import toast from 'react-hot-toast';
import {
    FiCheckCircle,
    FiRefreshCw,
    FiClock,
    FiWifi,
    FiWifiOff,
    FiBell,
    FiX,
    FiMessageCircle,
    FiSend,
    FiMaximize,
    FiMinimize,
} from 'react-icons/fi';
import { MdTableRestaurant } from 'react-icons/md';
import { BsBellFill, BsChatDots } from 'react-icons/bs';
import { UtensilsCrossed, Users } from 'lucide-react';

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
            gain.gain.exponentialRampToValueAtTime(
                0.001,
                ctx.currentTime + i * 0.15 + 0.4
            );
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.4);
        });
    } catch {
        /* no-op */
    }
}

export default function WaiterBoardPage() {
    const user = useSelector((state) => state.user);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [servingId, setServingId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [clock, setClock] = useState(new Date());
    const [serviceRequests, setServiceRequests] = useState([]);
    const [handlingId, setHandlingId] = useState(null);
    const [tableOrders, setTableOrders] = useState([]);
    const [cancelingId, setCancelingId] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpanded = () => setIsExpanded(!isExpanded);

    // Search states
    const [searchTableQuery, setSearchTableQuery] = useState('');
    const [searchReadyQuery, setSearchReadyQuery] = useState('');

    // Support Chat States
    const [chatRequests, setChatRequests] = useState([]);
    const [myConversations, setMyConversations] = useState([]);
    const [showChatModal, setShowChatModal] = useState(false);
    const [activeChatId, setActiveChatId] = useState(null);
    const [chatInput, setChatInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    const socketRef = useRef(null);
    const activeChatIdRef = useRef(null);

    // Sync activeChatId with ref
    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchReadyItems = useCallback(async () => {
        try {
            const res = await Axios({
                url: '/api/kitchen/waiter',
                method: 'GET',
            });
            if (res.data?.success) setItems(res.data.data);
        } catch {
            toast.error('Không thể tải danh sách món sẵn sàng.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchServiceRequests = useCallback(async () => {
        try {
            const res = await Axios({
                ...SummaryApi.get_pending_service_requests,
            });
            if (res.data?.success) setServiceRequests(res.data.data || []);
        } catch {
            /* silent */
        }
    }, []);

    const fetchTableOrders = useCallback(async () => {
        try {
            const res = await Axios({
                ...SummaryApi.get_all_active_table_orders,
            });
            if (res.data?.success) setTableOrders(res.data.data || []);
        } catch {
            /* silent */
        }
    }, []);

    useEffect(() => {
        fetchReadyItems();
        fetchServiceRequests();
        fetchTableOrders();

        const s = io(SOCKET_URL);
        socketRef.current = s;

        s.on('connect', () => {
            console.log('[Waiter] Socket connected:', s.id);
            setConnected(true);
            // Join waiter room for both kitchen and support chat
            const waiterData = {
                waiterId: user?._id || 'waiter_temp',
                waiterName: user?.name || 'Waiter',
            };
            console.log('[Waiter] Emitting waiter:join with:', waiterData);
            s.emit('waiter:join', waiterData);
        });

        s.on('disconnect', () => setConnected(false));

        // Kitchen events
        s.on('dish:ready', (data) => {
            playChime();
            toast(
                `🍽️ Bàn ${data.tableName} – "${data.productName}" sẵn sàng phục vụ!`,
                {
                    icon: <BsBellFill className="text-amber-500" />,
                    duration: 8000,
                    style: { border: '2px solid #f59e0b' },
                }
            );
            fetchReadyItems();
        });

        s.on('dish:served', () => fetchReadyItems());

        s.on('waiter:service_request', (data) => {
            playChime();
            toast(
                `🔔 Bàn ${data.tableNumber} gọi phục vụ${data.note ? ': "' + data.note + '"' : ''}`,
                {
                    icon: <FiBell className="text-orange-500" />,
                    duration: 10000,
                    style: { border: '2px solid #f97316' },
                }
            );
            setServiceRequests((prev) => [data, ...prev]);
        });

        s.on('waiter:service_request_updated', (data) => {
            setServiceRequests((prev) =>
                prev.filter((r) => r._id !== data._id)
            );
        });

        // Support Chat events
        s.on('waiter:newRequest', (data) => {
            console.log('[Waiter] Received new request:', data);
            playChime();
            toast(`💬 ${data.customerName} cần hỗ trợ chat!`, {
                icon: <BsChatDots className="text-blue-500" />,
                duration: 10000,
                style: { border: '2px solid #3b82f6' },
            });
            setChatRequests((prev) => [
                { ...data, _isNewRequest: true },
                ...prev,
            ]);
            setUnreadCount((prev) => prev + 1);
        });

        s.on('waiter:acceptSuccess', (data) => {
            console.log('[Waiter] Accept success data:', data);
            toast.success(`✅ Đã nhận chat từ ${data.customerName}`);
            // Remove from pending list (unreadCount đã giảm trước khi bấm accept)
            setChatRequests((prev) =>
                prev.filter((r) => r.conversationId !== data.conversationId)
            );

            const newConversation = {
                conversationId: data.conversationId,
                customerName: data.customerName,
                tableNumber: data.tableNumber,
                messages: data.messages || [],
                unread: 0,
            };
            console.log('[Waiter] Adding new conversation:', newConversation);

            setMyConversations((prev) => {
                const updated = [...prev, newConversation];
                console.log(
                    '[Waiter] Updated myConversations after accept:',
                    updated
                );
                return updated;
            });
        });

        s.on('waiter:acceptFailed', (data) => {
            toast.error(data.message);
            // Không giảm unreadCount ở đây vì request vẫn còn (chỉ waiter khác nhận thì mới giảm)
            setChatRequests((prev) =>
                prev.filter((r) => r.conversationId !== data.conversationId)
            );
        });

        s.on('waiter:requestAccepted', (data) => {
            // Waiter khác đã accept → xóa khỏi pending list và giảm unreadCount
            setChatRequests((prev) => {
                const existed = prev.some(
                    (r) => r.conversationId === data.conversationId
                );
                if (existed) {
                    setUnreadCount((c) => Math.max(0, c - 1));
                }
                return prev.filter(
                    (r) => r.conversationId !== data.conversationId
                );
            });
        });

        s.on('waiter:conversationJoined', (data) => {
            console.log('[Waiter] Joined conversation:', data.conversationId);
            // Update conversation với messages mới nhất từ server
            setMyConversations((prev) =>
                prev.map((conv) =>
                    conv.conversationId === data.conversationId
                        ? { ...conv, messages: data.messages || [] }
                        : conv
                )
            );
        });

        s.on('message:new', (msg) => {
            console.log('[Waiter] Received message:', msg);
            console.log('[Waiter] Current myConversations:', myConversations);
            console.log('[Waiter] Current activeChatId:', activeChatId);

            // Update conversation messages
            setMyConversations((prev) => {
                console.log('[Waiter] Previous conversations:', prev);
                const updated = prev.map((conv) => {
                    console.log(
                        '[Waiter] Checking conversation:',
                        conv.conversationId,
                        'vs message:',
                        msg.conversationId
                    );
                    if (conv.conversationId === msg.conversationId) {
                        // CHỐNG TRÙNG LẶP: Kiểm tra xem tin nhắn đã có chưa
                        const isDuplicate = (conv.messages || []).some(
                            (m) =>
                                (msg._id && m._id === msg._id) ||
                                (m.text === msg.text &&
                                    Math.abs(
                                        new Date(m.createdAt) -
                                            new Date(msg.createdAt)
                                    ) < 3000)
                        );

                        if (isDuplicate) {
                            // Nếu đã có (do Optimistic), cập nhật lại để có đầy đủ thông tin (như _id)
                            return {
                                ...conv,
                                messages: (conv.messages || []).map((m) =>
                                    m.text === msg.text && !m._id ? msg : m
                                ),
                            };
                        }

                        const isFromCustomer = msg.senderRole === 'customer';
                        const updatedConv = {
                            ...conv,
                            messages: [...(conv.messages || []), msg],
                            unread:
                                isFromCustomer &&
                                activeChatIdRef.current !== conv.conversationId
                                    ? (conv.unread || 0) + 1
                                    : conv.unread || 0,
                        };
                        return updatedConv;
                    }
                    return conv;
                });
                console.log('[Waiter] Final updated conversations:', updated);
                return updated;
            });

            // Show notification if not viewing this chat
            if (
                msg.senderRole === 'customer' &&
                activeChatIdRef.current !== msg.conversationId
            ) {
                console.log('[Waiter] Playing notification sound');
                setUnreadCount((prev) => prev + 1);
                playChime();
            }
        });

        // Refresh table orders khi có đơn mới hoặc khi món được phục vụ
        s.on('kitchen:new_order', () => fetchTableOrders());
        s.on('dish:served', () => {
            fetchReadyItems();
            fetchTableOrders();
        });

        return () => s.disconnect();
    }, [fetchReadyItems, fetchServiceRequests, fetchTableOrders, user]);

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
            toast.success(
                status === 'done'
                    ? 'Đã xử lý yêu cầu ✅'
                    : 'Đã cập nhật yêu cầu'
            );
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

    // Support Chat Handlers
    const acceptChatRequest = (conversationId) => {
        console.log('[Waiter] Accepting chat request:', conversationId);
        if (!socketRef.current) return;
        // Giảm unreadCount ngay khi bấm Nhận — request của bản thân không còn "mới"
        setChatRequests((prev) => {
            const existed = prev.some(
                (r) => r.conversationId === conversationId
            );
            if (existed) setUnreadCount((c) => Math.max(0, c - 1));
            return prev;
        });
        socketRef.current.emit('waiter:acceptRequest', {
            conversationId,
            waiterId: user?._id || 'waiter_temp',
            waiterName: user?.name || 'Waiter',
        });
    };

    const openChat = (conversationId) => {
        console.log('[Waiter] Opening chat for conversation:', conversationId);
        console.log(
            '[Waiter] Current myConversations when opening:',
            myConversations
        );

        setActiveChatId(conversationId);
        setShowChatModal(true);

        // Đảm bảo waiter join vào conversation room
        if (socketRef.current) {
            console.log('[Waiter] Joining conversation room:', conversationId);
            socketRef.current.emit('waiter:joinConversation', {
                conversationId,
                waiterId: user?._id || 'waiter_temp',
            });
        }

        // Mark as read
        setMyConversations((prev) =>
            prev.map((conv) =>
                conv.conversationId === conversationId
                    ? { ...conv, unread: 0 }
                    : conv
            )
        );
        // Recalculate unread count
        const totalUnread = myConversations.reduce(
            (sum, conv) =>
                conv.conversationId === conversationId
                    ? sum
                    : sum + (conv.unread || 0),
            0
        );
        setUnreadCount(totalUnread);
    };

    const closeChat = () => {
        setShowChatModal(false);
        setActiveChatId(null);
        setChatInput('');
    };

    const sendChatMessage = () => {
        if (!chatInput.trim() || !activeChatId || !socketRef.current) return;

        console.log(
            '[Waiter] Sending message to:',
            activeChatId,
            'text:',
            chatInput.trim()
        );

        socketRef.current.emit('waiter:message', {
            conversationId: activeChatId,
            text: chatInput.trim(),
            waiterName: user?.name || 'Waiter',
            waiterId: user?._id || 'waiter_temp',
        });

        // Add to local messages optimistically
        setMyConversations((prev) =>
            prev.map((conv) => {
                if (conv.conversationId === activeChatId) {
                    return {
                        ...conv,
                        messages: [
                            ...(conv.messages || []),
                            {
                                sender: socketRef.current.id,
                                senderName: user?.name || 'Waiter',
                                senderRole: 'waiter',
                                text: chatInput.trim(),
                                createdAt: new Date(),
                            },
                        ],
                    };
                }
                return conv;
            })
        );

        setChatInput('');
    };

    const closeConversation = (conversationId) => {
        if (!window.confirm('Đóng cuộc hội thoại này?')) return;

        if (socketRef.current) {
            socketRef.current.emit('waiter:closeConversation', {
                conversationId,
                waiterId: user?._id || 'waiter_temp',
            });
        }

        setMyConversations((prev) =>
            prev.filter((c) => c.conversationId !== conversationId)
        );
        if (activeChatId === conversationId) {
            closeChat();
        }
        toast.success('Đã đóng cuộc hội thoại');
    };

    // Build tableId → tableNumber map từ tableOrders đã có (tránh fetch thêm)
    const tableIdToNumber = tableOrders.reduce((map, order) => {
        if (order.tableId && order.tableNumber)
            map[order.tableId] = order.tableNumber;
        return map;
    }, {});

    // Group ready-items by table (resolve tableNumber from map)
    const grouped = items.reduce((acc, item) => {
        const rawId =
            typeof item.tableId === 'object' ? item.tableId?._id : item.tableId;
        const key =
            tableIdToNumber[rawId] ||
            item.tableId?.tableNumber ||
            item.tableId?.name ||
            rawId ||
            'Không rõ';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    return (
        <div
            className={`h-full bg-background text-foreground transition-all duration-300 animate-in fade-in ${
                isExpanded
                    ? 'fixed inset-0 z-[9999] overflow-y-auto w-full h-full'
                    : 'relative'
            }`}
        >
            {/* Header - Liquid Glass Style */}
            <div
                className="bg-card border-b-2 border-border px-4 py-3 sticky top-0 z-20 w-full shadow-md"
                style={{
                    background: 'rgba(var(--card-rgb, 255, 255, 255), 0.9)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <div className="mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-highlight/20"
                            style={{
                                background:
                                    'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                            }}
                        >
                            <MdTableRestaurant className="text-white text-xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-tight text-highlight leading-none">
                                Waiter Dashboard
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

                    <div className="hidden lg:flex items-center gap-2 md:gap-6">
                        <div className="text-center group">
                            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                <UtensilsCrossed className="w-4 h-4 text-highlight" />
                                <p className="text-xl font-bold text-highlight">
                                    {items.length}
                                </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-highlight transition-colors">
                                Chờ phục vụ
                            </p>
                        </div>
                        <div className="h-6 w-px bg-border/50" />
                        <div className="text-center group">
                            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                <Users className="w-4 h-4 text-blue-500" />
                                <p className="text-xl font-bold text-blue-500">
                                    {tableOrders.length}
                                </p>
                            </div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-blue-500 transition-colors">
                                Hoạt động
                            </p>
                        </div>
                        {serviceRequests.length > 0 && (
                            <>
                                <div className="h-6 w-px bg-border/50" />
                                <div className="text-center group">
                                    <div className="flex items-center justify-center gap-1.5 mb-0.5 animate-bounce">
                                        <FiBell className="w-4 h-4 text-orange-500" />
                                        <p className="text-xl font-bold text-orange-500">
                                            {serviceRequests.length}
                                        </p>
                                    </div>
                                    <p className="text-[10px] font-semibold uppercase text-muted-foreground group-hover:text-orange-500 transition-colors">
                                        Yêu cầu
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status indicators */}
                        <div
                            className={`hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border shadow-sm ${
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

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {/* Chat Notification Bell */}
                            <div className="relative">
                                <button
                                    onClick={() =>
                                        setShowNotifications(!showNotifications)
                                    }
                                    className={`flex items-center justify-center liquid-glass hover:bg-accent border-2 w-10 h-10 rounded-xl transition-all active:scale-90 relative ${
                                        unreadCount > 0
                                            ? 'border-blue-500/50 bg-blue-500/5 text-blue-500'
                                            : 'border-border'
                                    }`}
                                >
                                    <FiMessageCircle size={18} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-background animate-pulse">
                                            {unreadCount > 9
                                                ? '9+'
                                                : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Notification Dropdown - Liquid Glass */}
                                {showNotifications && (
                                    <div className="absolute right-0 mt-3 w-80 liquid-glass border-2 border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div
                                            className="px-4 py-3 flex items-center justify-between"
                                            style={{
                                                background:
                                                    'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                                            }}
                                        >
                                            <h3 className="font-bold text-white text-sm uppercase tracking-tight">
                                                Thông báo hỗ trợ
                                            </h3>
                                            <button
                                                onClick={() =>
                                                    setShowNotifications(false)
                                                }
                                                className="text-white/80 hover:text-white transition"
                                            >
                                                <FiX size={18} />
                                            </button>
                                        </div>
                                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                            {chatRequests.length > 0 && (
                                                <>
                                                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        Yêu cầu chờ
                                                    </p>
                                                    {chatRequests.map((req) => (
                                                        <div
                                                            key={
                                                                req.conversationId
                                                            }
                                                            onClick={() => {
                                                                acceptChatRequest(
                                                                    req.conversationId
                                                                );
                                                                setShowNotifications(
                                                                    false
                                                                );
                                                            }}
                                                            className="px-4 py-3 border-b border-border hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer transition"
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <p className="font-bold text-foreground flex items-center gap-1.5">
                                                                    <BsChatDots
                                                                        className="text-blue-500"
                                                                        size={
                                                                            13
                                                                        }
                                                                    />
                                                                    {
                                                                        req.customerName
                                                                    }
                                                                </p>
                                                                <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                                                                    Mới
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground italic">
                                                                Nhấn để nhận yêu
                                                                cầu hỗ trợ
                                                            </p>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                            {myConversations.filter(
                                                (c) => c.unread > 0
                                            ).length > 0 && (
                                                <>
                                                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        Tin chưa đọc
                                                    </p>
                                                    {myConversations
                                                        .filter(
                                                            (c) => c.unread > 0
                                                        )
                                                        .map((conv) => (
                                                            <div
                                                                key={
                                                                    conv.conversationId
                                                                }
                                                                onClick={() => {
                                                                    openChat(
                                                                        conv.conversationId
                                                                    );
                                                                    setShowNotifications(
                                                                        false
                                                                    );
                                                                }}
                                                                className="px-4 py-3 border-b border-border hover:bg-accent cursor-pointer transition"
                                                            >
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <p className="font-bold text-foreground">
                                                                        {
                                                                            conv.customerName
                                                                        }
                                                                    </p>
                                                                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                                                                        {
                                                                            conv.unread
                                                                        }
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground truncate">
                                                                    {conv
                                                                        .messages?.[
                                                                        conv
                                                                            .messages
                                                                            .length -
                                                                            1
                                                                    ]?.text ||
                                                                        'Tin nhắn mới'}
                                                                </p>
                                                            </div>
                                                        ))}
                                                </>
                                            )}
                                            {chatRequests.length === 0 &&
                                                myConversations.filter(
                                                    (c) => c.unread > 0
                                                ).length === 0 && (
                                                    <div className="p-6 text-center text-muted-foreground">
                                                        <FiBell
                                                            size={32}
                                                            className="mx-auto mb-2 opacity-30"
                                                        />
                                                        <p className="text-xs italic uppercase font-bold tracking-widest">
                                                            Không có thông báo
                                                        </p>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>

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
                                onClick={() => {
                                    fetchReadyItems();
                                    fetchServiceRequests();
                                    fetchTableOrders();
                                }}
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

            {/* Content */}
            <div className="mx-auto p-6 space-y-8">
                {/* Chat Requests Panel */}
                {chatRequests.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-lg font-bold text-blue-500 uppercase tracking-tight flex items-center gap-2.5">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <BsChatDots className="animate-bounce" />
                                </div>
                                Yêu cầu Chat ({chatRequests.length})
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {chatRequests.map((req) => (
                                <div
                                    key={req.conversationId}
                                    className="rounded-2xl p-5 flex flex-col gap-4 border-2 border-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/10 active:scale-[0.99] liquid-glass"
                                    style={{
                                        background:
                                            'rgba(var(--card-rgb, 255, 255, 255), 0.8)',
                                    }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-bold text-blue-600 dark:text-blue-400 text-base flex items-center gap-1.5">
                                                <BsChatDots className="w-4 h-4" />{' '}
                                                {req.customerName}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {req.tableNumber
                                                    ? `Bàn ${req.tableNumber}`
                                                    : 'Khách online'}
                                            </p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(
                                                req.createdAt
                                            ).toLocaleTimeString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() =>
                                            acceptChatRequest(
                                                req.conversationId
                                            )
                                        }
                                        className="w-full flex items-center justify-center gap-2 text-white py-2 rounded-xl text-sm font-semibold transition active:scale-95"
                                        style={{
                                            background:
                                                'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                                        }}
                                    >
                                        <FiCheckCircle size={14} /> Nhận Chat
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* My Conversations Panel */}
                {myConversations.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-lg font-bold text-highlight uppercase tracking-tight flex items-center gap-2.5">
                                <div className="p-2 bg-highlight/10 rounded-lg">
                                    <FiMessageCircle />
                                </div>
                                Chat của tôi ({myConversations.length})
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {myConversations.map((conv) => (
                                <div
                                    key={conv.conversationId}
                                    className="rounded-2xl p-5 flex flex-col gap-4 border-2 border-border transition-all hover:shadow-xl hover:shadow-highlight/10 active:scale-[0.99] liquid-glass"
                                    style={{
                                        background:
                                            'rgba(var(--card-rgb, 255, 255, 255), 0.8)',
                                    }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-bold text-foreground text-base">
                                                {conv.customerName}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {conv.messages?.length || 0} tin
                                                nhắn
                                            </p>
                                        </div>
                                        {conv.unread > 0 && (
                                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                                                {conv.unread}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() =>
                                                openChat(conv.conversationId)
                                            }
                                            className="flex-1 flex items-center justify-center gap-1 text-white py-2 rounded-xl text-sm font-semibold transition active:scale-95"
                                            style={{
                                                background:
                                                    'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                                            }}
                                        >
                                            <FiMessageCircle size={14} /> Mở
                                            Chat
                                        </button>
                                        <button
                                            onClick={() =>
                                                closeConversation(
                                                    conv.conversationId
                                                )
                                            }
                                            className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-xl text-sm transition active:scale-95"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Service Requests Panel */}
                {serviceRequests.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-lg font-bold text-orange-500 uppercase tracking-tight flex items-center gap-2.5">
                                <div className="p-2 bg-orange-500/10 rounded-lg">
                                    <FiBell className="animate-bounce" />
                                </div>
                                Yêu cầu gọi phục vụ ({serviceRequests.length})
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {serviceRequests.map((req) => (
                                <div
                                    key={req._id}
                                    className="rounded-2xl p-5 flex flex-col gap-4 border-2 border-orange-500/30 transition-all hover:shadow-xl hover:shadow-orange-500/10 active:scale-[0.99] liquid-glass"
                                    style={{
                                        background:
                                            'rgba(var(--card-rgb, 255, 255, 255), 0.8)',
                                    }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-bold text-orange-600 dark:text-orange-400 text-base flex items-center gap-1.5">
                                                <FiBell className="w-4 h-4" />{' '}
                                                Bàn {req.tableNumber}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {req.type === 'cancel_item'
                                                    ? 'Muốn huỷ món'
                                                    : req.type === 'assistance'
                                                      ? 'Cần hỗ trợ'
                                                      : 'Khác'}
                                            </p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(
                                                req.createdAt
                                            ).toLocaleTimeString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                    {req.note && (
                                        <p className="text-sm text-foreground bg-accent rounded-lg px-3 py-2 italic border border-border">
                                            "{req.note}"
                                        </p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() =>
                                                handleServiceRequest(
                                                    req._id,
                                                    'done'
                                                )
                                            }
                                            disabled={handlingId === req._id}
                                            className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 active:scale-95"
                                        >
                                            <FiCheckCircle size={14} /> Đã xử lý
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleServiceRequest(
                                                    req._id,
                                                    'rejected'
                                                )
                                            }
                                            disabled={handlingId === req._id}
                                            className="flex items-center justify-center gap-1 bg-accent hover:bg-accent/80 text-foreground border border-border px-3 py-2 rounded-xl text-sm transition disabled:opacity-60 active:scale-95"
                                        >
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* === MAIN 2-COLUMN LAYOUT === */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: Đơn đang chạy theo bàn */}
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-highlight/10 rounded-lg text-highlight">
                                    <MdTableRestaurant className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold uppercase tracking-tight">
                                    Đơn đang chạy
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-highlight text-white shadow-sm">
                                    {tableOrders.length}
                                </span>
                            </div>
                        </div>

                        {/* Search for tables */}
                        <div className="mb-4">
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={searchTableQuery}
                                    onChange={(e) =>
                                        setSearchTableQuery(e.target.value)
                                    }
                                    placeholder="TÌM BÀN..."
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border-2 border-border bg-card focus:border-highlight focus:outline-none transition-all shadow-sm"
                                />
                                <MdTableRestaurant
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-highlight transition-colors"
                                    size={18}
                                />
                                {searchTableQuery && (
                                    <button
                                        onClick={() => setSearchTableQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-highlight transition-colors"
                                    >
                                        <FiX size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div
                            className="overflow-y-auto space-y-3 pr-2 custom-scrollbar"
                            style={{ maxHeight: 'calc(100vh - 280px)' }}
                        >
                            {tableOrders.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    Không có đơn nào đang chạy
                                </div>
                            ) : (
                                tableOrders
                                    .filter(
                                        (order) =>
                                            searchTableQuery.trim() === '' ||
                                            (order.tableNumber &&
                                                order.tableNumber
                                                    .toString()
                                                    .toLowerCase()
                                                    .includes(
                                                        searchTableQuery
                                                            .trim()
                                                            .toLowerCase()
                                                    ))
                                    )
                                    .map((order) => (
                                        <div
                                            key={order._id}
                                            className="rounded-2xl overflow-hidden border-2 border-border transition-all hover:shadow-xl hover:border-highlight/30 active:scale-[0.99] liquid-glass"
                                            style={{
                                                background:
                                                    'rgba(var(--card-rgb, 255, 255, 255), 0.8)',
                                            }}
                                        >
                                            {/* Table header */}
                                            <div
                                                className="px-5 py-4 flex items-center justify-between border-b-2 border-border"
                                                style={{
                                                    background:
                                                        'linear-gradient(135deg, rgba(201, 96, 72, 0.1) 0%, rgba(217, 122, 102, 0.05) 100%)',
                                                }}
                                            >
                                                <h3 className="font-bold flex items-center gap-2.5 text-highlight uppercase tracking-tight">
                                                    <MdTableRestaurant className="w-5 h-5" />{' '}
                                                    Bàn {order.tableNumber}
                                                </h3>
                                                <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-highlight/10 text-highlight rounded-lg border border-highlight/20">
                                                    {order.items.length} món
                                                </span>
                                            </div>
                                            {/* Items */}
                                            <div className="p-3 space-y-2">
                                                {order.items.map((item) => {
                                                    const isPending =
                                                        item.kitchenStatus ===
                                                        'pending';
                                                    const statusLabel = {
                                                        pending: {
                                                            text: 'Chờ bếp',
                                                            cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                                                        },
                                                        cooking: {
                                                            text: 'Đang nấu',
                                                            cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                                                        },
                                                        ready: {
                                                            text: 'Xong',
                                                            cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                                                        },
                                                        served: {
                                                            text: 'Đã phục vụ',
                                                            cls: 'bg-accent text-muted-foreground',
                                                        },
                                                    }[item.kitchenStatus] || {
                                                        text: item.kitchenStatus,
                                                        cls: 'bg-accent text-muted-foreground',
                                                    };
                                                    return (
                                                        <div
                                                            key={item._id}
                                                            className="flex items-center justify-between gap-4 bg-accent/30 rounded-2xl px-4 py-3 border-2 border-border/50 hover:border-highlight/30 transition-all group/item"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <div className="mb-1">
                                                                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 bg-muted rounded text-muted-foreground border border-border">
                                                                        #
                                                                        {item.productId
                                                                            ?.slice(
                                                                                -4
                                                                            )
                                                                            .toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <p className="font-bold text-sm uppercase tracking-tight text-foreground group-hover/item:text-highlight transition-colors leading-tight mb-1">
                                                                    {item.name}
                                                                </p>
                                                                <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                                    <span className="text-highlight">
                                                                        x
                                                                        {
                                                                            item.quantity
                                                                        }
                                                                    </span>
                                                                    <span className="text-border">
                                                                        ·
                                                                    </span>
                                                                    <span>
                                                                        {item.price.toLocaleString(
                                                                            'vi-VN'
                                                                        )}
                                                                        đ
                                                                    </span>
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <span
                                                                    className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase shadow-sm ${
                                                                        item.kitchenStatus ===
                                                                        'served'
                                                                            ? 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/20'
                                                                            : statusLabel.cls
                                                                    }`}
                                                                >
                                                                    {
                                                                        statusLabel.text
                                                                    }
                                                                </span>
                                                                {isPending && (
                                                                    <button
                                                                        onClick={() =>
                                                                            cancelItem(
                                                                                order._id,
                                                                                item._id,
                                                                                item.name
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            cancelingId ===
                                                                            item._id
                                                                        }
                                                                        className="flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white w-8 h-8 rounded-lg transition-all disabled:opacity-50 active:scale-90 shadow-sm"
                                                                        title="Huỷ món"
                                                                    >
                                                                        <FiX
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Món sẵn sàng từ bếp */}
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/10 rounded-lg text-green-600">
                                    <FiCheckCircle className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold uppercase tracking-tight">
                                    Sẵn sàng phục vụ
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white shadow-sm">
                                    {items.length}
                                </span>
                            </div>
                        </div>

                        {/* Search for ready items */}
                        <div className="mb-4">
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={searchReadyQuery}
                                    onChange={(e) =>
                                        setSearchReadyQuery(e.target.value)
                                    }
                                    placeholder="TÌM MÓN HOẶC BÀN..."
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border-2 border-border bg-card focus:border-highlight focus:outline-none transition-all shadow-sm"
                                />
                                <UtensilsCrossed
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-highlight transition-colors"
                                    size={18}
                                />
                                {searchReadyQuery && (
                                    <button
                                        onClick={() => setSearchReadyQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-highlight transition-colors"
                                    >
                                        <FiX size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div
                            className="overflow-y-auto space-y-3 pr-2 custom-scrollbar"
                            style={{ maxHeight: 'calc(100vh - 280px)' }}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center h-64 text-muted-foreground">
                                    <div
                                        className="animate-spin rounded-full h-10 w-10 border-b-2 mr-3"
                                        style={{ borderColor: '#C96048' }}
                                    />
                                    Đang tải...
                                </div>
                            ) : items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                                    <FiCheckCircle className="text-6xl text-green-500" />
                                    <p className="text-lg font-semibold text-foreground">
                                        Tất cả món đã được phục vụ 🎉
                                    </p>
                                    <p className="text-sm">
                                        Không có món nào đang chờ.
                                    </p>
                                </div>
                            ) : (
                                items
                                    .filter((item) => {
                                        if (searchReadyQuery.trim() === '')
                                            return true;
                                        const query =
                                            searchReadyQuery.toLowerCase();
                                        const productName =
                                            item.product?.name?.toLowerCase() ||
                                            '';
                                        let tableName = 'không rõ';
                                        if (item.tableId) {
                                            if (
                                                typeof item.tableId === 'object'
                                            ) {
                                                tableName = (
                                                    item.tableId.tableNumber ||
                                                    item.tableId.name ||
                                                    item.tableId.tableName ||
                                                    tableIdToNumber[
                                                        item.tableId._id
                                                    ] ||
                                                    item.tableId._id
                                                )
                                                    .toString()
                                                    .toLowerCase();
                                            } else {
                                                tableName = (
                                                    tableIdToNumber[
                                                        item.tableId
                                                    ] || item.tableId
                                                )
                                                    .toString()
                                                    .toLowerCase();
                                            }
                                        }
                                        return (
                                            productName.includes(query) ||
                                            tableName.includes(query)
                                        );
                                    })
                                    .map((item) => {
                                        const readyMinutes = item.readyAt
                                            ? Math.floor(
                                                  (Date.now() -
                                                      new Date(item.readyAt)) /
                                                      60000
                                              )
                                            : null;
                                        const isUrgent =
                                            readyMinutes !== null &&
                                            readyMinutes >= 5;

                                        // Get table name
                                        let tableName = 'Không rõ';
                                        if (item.tableId) {
                                            if (
                                                typeof item.tableId === 'object'
                                            ) {
                                                tableName =
                                                    item.tableId.tableNumber ||
                                                    item.tableId.name ||
                                                    item.tableId.tableName ||
                                                    tableIdToNumber[
                                                        item.tableId._id
                                                    ] ||
                                                    item.tableId._id;
                                            } else {
                                                tableName =
                                                    tableIdToNumber[
                                                        item.tableId
                                                    ] || item.tableId;
                                            }
                                        }

                                        return (
                                            <div
                                                key={item._id}
                                                className={`rounded-2xl p-5 flex flex-col gap-4 transition-all border-2 ${
                                                    isUrgent
                                                        ? 'border-red-500 animate-pulse bg-red-500/5 shadow-lg shadow-red-500/20'
                                                        : 'border-border hover:shadow-xl hover:border-highlight/30 liquid-glass'
                                                }`}
                                                style={
                                                    !isUrgent
                                                        ? {
                                                              background:
                                                                  'rgba(var(--card-rgb, 255, 255, 255), 0.8)',
                                                          }
                                                        : {}
                                                }
                                            >
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[11px] font-bold font-mono px-2 py-0.5 bg-muted rounded-md text-muted-foreground border border-border">
                                                            #
                                                            {item._id
                                                                ?.slice(-4)
                                                                .toUpperCase()}
                                                        </span>
                                                        <span
                                                            className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg shadow-sm border border-highlight/20"
                                                            style={{
                                                                background:
                                                                    'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                                                                color: 'white',
                                                            }}
                                                        >
                                                            Bàn {tableName}
                                                        </span>
                                                    </div>
                                                    <p className="text-base font-bold uppercase tracking-tight text-highlight leading-tight mb-1">
                                                        {item.product?.name ||
                                                            'Món ăn'}
                                                    </p>
                                                    <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                        <span className="text-highlight">
                                                            x{item.quantity}
                                                        </span>
                                                        {item.product
                                                            ?.price && (
                                                            <>
                                                                <span className="text-border">
                                                                    ·
                                                                </span>
                                                                <span>
                                                                    {item.product.price.toLocaleString(
                                                                        'vi-VN'
                                                                    )}
                                                                    đ
                                                                </span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="bg-green-500/10 text-green-600 text-[10px] px-2.5 py-1 rounded-lg border border-green-500/20 whitespace-nowrap font-bold uppercase tracking-wider">
                                                        Sẵn sàng ✓
                                                    </div>
                                                    {readyMinutes !== null && (
                                                        <p
                                                            className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}
                                                        >
                                                            <FiClock
                                                                size={12}
                                                            />
                                                            {isUrgent
                                                                ? `⚠️ Đợi ${readyMinutes} phút!`
                                                                : `Xong lúc ${new Date(item.readyAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                                                        </p>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        markServed(
                                                            item.orderId,
                                                            item._id
                                                        )
                                                    }
                                                    disabled={
                                                        servingId === item._id
                                                    }
                                                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-60 active:scale-95"
                                                >
                                                    <FiCheckCircle />
                                                    {servingId === item._id
                                                        ? 'Đang xử lý...'
                                                        : 'Đã phục vụ'}
                                                </button>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Modal */}
            {showChatModal && activeChatId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <div
                        className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border-2 border-border liquid-glass"
                        style={{
                            background:
                                'rgba(var(--card-rgb, 255, 255, 255), 0.9)',
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            className="px-6 py-4 flex items-center justify-between border-b-2 border-border/50"
                            style={{
                                background:
                                    'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                            }}
                        >
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {myConversations.find(
                                        (c) => c.conversationId === activeChatId
                                    )?.customerName || 'Chat'}
                                </h3>
                                <p className="text-white/90 text-sm">
                                    {myConversations.find(
                                        (c) => c.conversationId === activeChatId
                                    )?.messages?.length || 0}{' '}
                                    tin nhắn
                                </p>
                            </div>
                            <button
                                onClick={closeChat}
                                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white transition"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 bg-accent/30 space-y-3 custom-scrollbar">
                            {myConversations
                                .find((c) => c.conversationId === activeChatId)
                                ?.messages?.map((msg, idx) => {
                                    if (msg.senderRole === 'system') {
                                        return (
                                            <div
                                                key={idx}
                                                className="flex justify-center"
                                            >
                                                <div className="px-4 py-1 rounded-full bg-accent/50 text-muted-foreground text-[10px] font-bold uppercase tracking-wider border border-border">
                                                    {msg.text}
                                                </div>
                                            </div>
                                        );
                                    }

                                    const isWaiter =
                                        msg.senderRole === 'waiter';
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex ${isWaiter ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                                                    isWaiter
                                                        ? 'bg-blue-500 text-white rounded-br-sm'
                                                        : 'bg-card border border-border text-foreground rounded-bl-sm'
                                                }`}
                                            >
                                                <p className="text-sm leading-relaxed">
                                                    {msg.text}
                                                </p>
                                                <p
                                                    className={`text-xs mt-1 ${isWaiter ? 'text-blue-100' : 'text-muted-foreground'}`}
                                                >
                                                    {new Date(
                                                        msg.createdAt
                                                    ).toLocaleTimeString(
                                                        'vi-VN',
                                                        {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        }
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Input */}
                        <div className="bg-card border-t-2 border-border p-4">
                            <div className="flex gap-3">
                                <textarea
                                    value={chatInput}
                                    onChange={(e) => {
                                        setChatInput(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                    }}
                                    onKeyDownCapture={(e) => {
                                        if (e.key === 'Enter') {
                                            e.stopPropagation();
                                            if (!e.shiftKey) {
                                                e.preventDefault();
                                                sendChatMessage();
                                                e.target.style.height = 'auto';
                                            }
                                        }
                                    }}
                                    placeholder="NHẬP TIN NHẮN..."
                                    rows={1}
                                    className="flex-1 px-4 py-2.5 border-2 border-border rounded-xl focus:border-blue-500 focus:outline-none bg-background text-foreground resize-none overflow-y-auto leading-relaxed text-sm"
                                    style={{ minHeight: '44px' }}
                                />
                                <button
                                    onClick={() => {
                                        sendChatMessage();
                                        // Reset height if we can find the element
                                        const textarea = document.querySelector(
                                            'textarea[placeholder="Nhập tin nhắn..."]'
                                        );
                                        if (textarea)
                                            textarea.style.height = 'auto';
                                    }}
                                    disabled={!chatInput.trim()}
                                    className="px-6 py-2.5 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 h-fit mt-auto"
                                    style={{
                                        background: chatInput.trim()
                                            ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                                            : 'rgba(59, 130, 246, 0.5)',
                                    }}
                                >
                                    <FiSend size={16} /> Gửi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
}
