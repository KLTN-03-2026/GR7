import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';
import Axios from '../utils/Axios';
import SummaryApi from '../common/SummaryApi';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiRefreshCw, FiClock, FiWifi, FiWifiOff, FiBell, FiX, FiMessageCircle, FiSend } from 'react-icons/fi';
import { MdTableRestaurant } from 'react-icons/md';
import { BsBellFill, BsChatDots } from 'react-icons/bs';

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
        
        s.on('connect', () => {
            console.log('[Waiter] Socket connected:', s.id);
            setConnected(true);
            // Join waiter room for both kitchen and support chat
            const waiterData = { 
                waiterId: user?._id || 'waiter_temp', 
                waiterName: user?.name || 'Waiter' 
            };
            console.log('[Waiter] Emitting waiter:join with:', waiterData);
            s.emit('waiter:join', waiterData);
        });
        
        s.on('disconnect', () => setConnected(false));

        // Kitchen events
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

        // Support Chat events
        s.on('waiter:newRequest', (data) => {
            console.log('[Waiter] Received new request:', data);
            playChime();
            toast(`💬 ${data.customerName} cần hỗ trợ chat!`, {
                icon: <BsChatDots className="text-blue-500" />,
                duration: 10000,
                style: { border: '2px solid #3b82f6' },
            });
            setChatRequests((prev) => [data, ...prev]);
            setUnreadCount((prev) => prev + 1);
        });

        s.on('waiter:acceptSuccess', (data) => {
            console.log('[Waiter] Accept success data:', data);
            toast.success(`✅ Đã nhận chat từ ${data.customerName}`);
            setChatRequests((prev) => prev.filter(r => r.conversationId !== data.conversationId));
            
            const newConversation = {
                conversationId: data.conversationId,
                customerName: data.customerName,
                tableNumber: data.tableNumber,
                messages: data.messages || [],
                unread: 0
            };
            console.log('[Waiter] Adding new conversation:', newConversation);
            
            setMyConversations((prev) => {
                const updated = [...prev, newConversation];
                console.log('[Waiter] Updated myConversations after accept:', updated);
                return updated;
            });
        });

        s.on('waiter:acceptFailed', (data) => {
            toast.error(data.message);
            setChatRequests((prev) => prev.filter(r => r.conversationId !== data.conversationId));
        });

        s.on('waiter:requestAccepted', (data) => {
            setChatRequests((prev) => prev.filter(r => r.conversationId !== data.conversationId));
        });

        s.on('waiter:conversationJoined', (data) => {
            console.log('[Waiter] Joined conversation:', data.conversationId);
            // Update conversation với messages mới nhất từ server
            setMyConversations((prev) => prev.map(conv => 
                conv.conversationId === data.conversationId 
                    ? { ...conv, messages: data.messages || [] }
                    : conv
            ));
        });

        s.on('message:new', (msg) => {
            console.log('[Waiter] Received message:', msg);
            console.log('[Waiter] Current myConversations:', myConversations);
            console.log('[Waiter] Current activeChatId:', activeChatId);
            
            // Update conversation messages
            setMyConversations((prev) => {
                console.log('[Waiter] Previous conversations:', prev);
                const updated = prev.map(conv => {
                    console.log('[Waiter] Checking conversation:', conv.conversationId, 'vs message:', msg.conversationId);
                    if (conv.conversationId === msg.conversationId) {
                        console.log('[Waiter] MATCH! Adding message to conversation:', msg.conversationId);
                        const isFromCustomer = msg.senderRole === 'customer';
                        const updatedConv = {
                            ...conv,
                            messages: [...(conv.messages || []), msg],
                            unread: isFromCustomer && activeChatIdRef.current !== conv.conversationId 
                                ? (conv.unread || 0) + 1 
                                : conv.unread || 0
                        };
                        console.log('[Waiter] Updated conversation:', updatedConv);
                        return updatedConv;
                    }
                    return conv;
                });
                console.log('[Waiter] Final updated conversations:', updated);
                return updated;
            });
            
            // Show notification if not viewing this chat
            if (msg.senderRole === 'customer' && activeChatIdRef.current !== msg.conversationId) {
                console.log('[Waiter] Playing notification sound');
                setUnreadCount((prev) => prev + 1);
                playChime();
            }
        });

        // Refresh table orders khi có đơn mới hoặc khi món được phục vụ
        s.on('kitchen:new_order', () => fetchTableOrders());
        s.on('dish:served', () => { fetchReadyItems(); fetchTableOrders(); });

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

    // Support Chat Handlers
    const acceptChatRequest = (conversationId) => {
        console.log('[Waiter] Accepting chat request:', conversationId);
        if (!socketRef.current) return;
        socketRef.current.emit('waiter:acceptRequest', {
            conversationId,
            waiterId: user?._id || 'waiter_temp',
            waiterName: user?.name || 'Waiter'
        });
    };

    const openChat = (conversationId) => {
        console.log('[Waiter] Opening chat for conversation:', conversationId);
        console.log('[Waiter] Current myConversations when opening:', myConversations);
        
        setActiveChatId(conversationId);
        setShowChatModal(true);
        
        // Đảm bảo waiter join vào conversation room
        if (socketRef.current) {
            console.log('[Waiter] Joining conversation room:', conversationId);
            socketRef.current.emit('waiter:joinConversation', {
                conversationId,
                waiterId: user?._id || 'waiter_temp'
            });
        }
        
        // Mark as read
        setMyConversations((prev) => prev.map(conv => 
            conv.conversationId === conversationId 
                ? { ...conv, unread: 0 }
                : conv
        ));
        // Recalculate unread count
        const totalUnread = myConversations.reduce((sum, conv) => 
            conv.conversationId === conversationId ? sum : sum + (conv.unread || 0), 0
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
        
        console.log('[Waiter] Sending message to:', activeChatId, 'text:', chatInput.trim());
        
        socketRef.current.emit('waiter:message', {
            conversationId: activeChatId,
            text: chatInput.trim(),
            waiterName: user?.name || 'Waiter',
            waiterId: user?._id || 'waiter_temp'
        });

        // Add to local messages optimistically
        setMyConversations((prev) => prev.map(conv => {
            if (conv.conversationId === activeChatId) {
                return {
                    ...conv,
                    messages: [...(conv.messages || []), {
                        sender: socketRef.current.id,
                        senderName: user?.name || 'Waiter',
                        senderRole: 'waiter',
                        text: chatInput.trim(),
                        createdAt: new Date()
                    }]
                };
            }
            return conv;
        }));

        setChatInput('');
    };

    const closeConversation = (conversationId) => {
        if (!window.confirm('Đóng cuộc hội thoại này?')) return;
        
        if (socketRef.current) {
            socketRef.current.emit('waiter:closeConversation', {
                conversationId,
                waiterId: user?._id || 'waiter_temp'
            });
        }

        setMyConversations((prev) => prev.filter(c => c.conversationId !== conversationId));
        if (activeChatId === conversationId) {
            closeChat();
        }
        toast.success('Đã đóng cuộc hội thoại');
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
                        {chatRequests.length > 0 && (
                            <>
                                <div className="h-8 w-px bg-amber-800" />
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-blue-400 animate-bounce">{chatRequests.length}</p>
                                    <p className="text-xs text-blue-500">Chat mới</p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative flex items-center justify-center w-10 h-10 rounded-full bg-amber-800 hover:bg-amber-700 transition"
                            >
                                <FiBell size={18} className="text-amber-200" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                            
                            {/* Notification Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 flex items-center justify-between">
                                        <h3 className="font-bold text-white">Thông báo Chat</h3>
                                        <button onClick={() => setShowNotifications(false)} className="text-white/80 hover:text-white">
                                            <FiX size={18} />
                                        </button>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        {myConversations.filter(c => c.unread > 0).length === 0 ? (
                                            <div className="p-6 text-center text-gray-500">
                                                <FiBell size={32} className="mx-auto mb-2 opacity-30" />
                                                <p className="text-sm">Không có tin nhắn mới</p>
                                            </div>
                                        ) : (
                                            myConversations.filter(c => c.unread > 0).map(conv => (
                                                <div
                                                    key={conv.conversationId}
                                                    onClick={() => {
                                                        openChat(conv.conversationId);
                                                        setShowNotifications(false);
                                                    }}
                                                    className="px-4 py-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition"
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="font-semibold text-gray-800">{conv.customerName}</p>
                                                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                                                            {conv.unread}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 truncate">
                                                        {conv.messages?.[conv.messages.length - 1]?.text || 'Tin nhắn mới'}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
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

                {/* Chat Requests Panel */}
                {chatRequests.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                            <BsChatDots className="animate-bounce" /> Yêu cầu Chat ({chatRequests.length})
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {chatRequests.map((req) => (
                                <div key={req.conversationId} className="bg-blue-900/40 border border-blue-600/60 rounded-2xl p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-bold text-blue-300 text-base">💬 {req.customerName}</p>
                                            <p className="text-xs text-blue-400/70 mt-0.5">
                                                {req.tableNumber ? `Bàn ${req.tableNumber}` : 'Khách online'}
                                            </p>
                                        </div>
                                        <span className="text-xs text-blue-500/60">
                                            {new Date(req.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => acceptChatRequest(req.conversationId)}
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-semibold transition"
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
                    <div>
                        <h2 className="text-lg font-bold text-blue-300 mb-3 flex items-center gap-2">
                            <FiMessageCircle /> Chat của tôi ({myConversations.length})
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {myConversations.map((conv) => (
                                <div key={conv.conversationId} className="bg-blue-900/30 border border-blue-700/50 rounded-2xl p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-bold text-blue-200 text-base">{conv.customerName}</p>
                                            <p className="text-xs text-blue-400/70 mt-0.5">
                                                {conv.messages?.length || 0} tin nhắn
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
                                            onClick={() => openChat(conv.conversationId)}
                                            className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-semibold transition"
                                        >
                                            <FiMessageCircle size={14} /> Mở Chat
                                        </button>
                                        <button
                                            onClick={() => closeConversation(conv.conversationId)}
                                            className="flex items-center justify-center gap-1 bg-red-700 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-sm transition"
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

            {/* Chat Modal */}
            {showChatModal && activeChatId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {myConversations.find(c => c.conversationId === activeChatId)?.customerName || 'Chat'}
                                </h3>
                                <p className="text-blue-100 text-sm">
                                    {myConversations.find(c => c.conversationId === activeChatId)?.messages?.length || 0} tin nhắn
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
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-3">
                            {myConversations.find(c => c.conversationId === activeChatId)?.messages?.map((msg, idx) => {
                                if (msg.senderRole === 'system') {
                                    return (
                                        <div key={idx} className="flex justify-center">
                                            <div className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-xs">
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                }
                                
                                const isWaiter = msg.senderRole === 'waiter';
                                return (
                                    <div key={idx} className={`flex ${isWaiter ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                                            isWaiter 
                                                ? 'bg-blue-500 text-white rounded-br-sm' 
                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                                        }`}>
                                            <p className="text-sm leading-relaxed">{msg.text}</p>
                                            <p className={`text-xs mt-1 ${isWaiter ? 'text-blue-100' : 'text-gray-500'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input */}
                        <div className="bg-white border-t border-gray-200 p-4">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                                    placeholder="Nhập tin nhắn..."
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-gray-800"
                                />
                                <button
                                    onClick={sendChatMessage}
                                    disabled={!chatInput.trim()}
                                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <FiSend size={16} /> Gửi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}