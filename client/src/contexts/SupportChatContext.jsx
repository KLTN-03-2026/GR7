import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
    useCallback,
} from 'react';
import { useSelector } from 'react-redux';
import { getSocket, destroySocket } from '../utils/socket';
import Axios from '../utils/Axios';
import SummaryApi from '../common/SummaryApi';
const AI_GREETING =
    'Xin chào! Tôi là trợ lý AI của EatEase 🍽️. Tôi có thể giúp bạn tìm món ăn, giải đáp thắc mắc về đặt bàn, chính sách và nhiều hơn nữa. Bạn cần hỗ trợ gì?';
const GUEST_AI_TTL_DAYS = 3; // Guest chat history tự xóa sau 3 ngày
const GUEST_AI_LIMIT = 10; // Giới hạn 10 tin nhắn/ngày cho Guest

function getAiStorageKey(userId) {
    return userId ? `tc_ai_messages_${userId}` : 'tc_ai_messages_guest';
}
function getAiTimestampKey(userId) {
    return userId ? null : 'tc_ai_messages_guest_ts';
}
function getAiGuestLimitKey() {
    return 'tc_ai_guest_msg_count';
}
function getAiGuestLastResetKey() {
    return 'tc_ai_guest_last_reset';
}

// Dùng prefix để phân biệt guest session và user session
const GUEST_STORAGE_KEY = 'tc_support_conv_guest';
const USER_STORAGE_KEY_PREFIX = 'tc_support_conv_user_';

function getStorageKey(userId) {
    return userId ? `${USER_STORAGE_KEY_PREFIX}${userId}` : GUEST_STORAGE_KEY;
}

// Create Support Chat Context
const SupportChatContext = createContext();

export const useSupportChat = () => {
    const context = useContext(SupportChatContext);
    if (!context) {
        throw new Error(
            'useSupportChat must be used within a SupportChatProvider'
        );
    }
    return context;
};

export const SupportChatProvider = ({ children }) => {
    const user = useSelector((state) => state.user);

    // Support chat shared state
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    const [adminTyping, setAdminTyping] = useState(false);
    const [requestStatus, setRequestStatus] = useState('waiting');
    const [assignedWaiterName, setAssignedWaiterName] = useState(null);
    const [nameEntered, setNameEntered] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [chatExpiresAt, setChatExpiresAt] = useState(null); // TTL info
    const [chatDaysLeft, setChatDaysLeft] = useState(null); // TTL info

    // AI chat shared state
    const [aiMessages, setAiMessages] = useState([
        { role: 'bot', text: AI_GREETING },
    ]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiCooldown, setAiCooldown] = useState(0);
    const aiCooldownRef = useRef(null);
    const prevAiUserIdRef = useRef(undefined); // track user changes for AI messages

    // Refs
    const conversationIdRef = useRef(null);
    const socketRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const prevUserIdRef = useRef(null);

    // Register socket events
    const registerSocketEvents = useCallback(
        (socket, resolvedName, resolvedUserId) => {
            console.log(
                '[SupportChat] Registering socket events for:',
                resolvedName
            );

            // Clean old listeners
            socket.off('connect');
            socket.off('conversation:created');
            socket.off('conversation:joined');
            socket.off('waiter:joined');
            socket.off('message:new');
            socket.off('admin:typing');
            socket.off('conversation:closed');
            socket.off('disconnect');
            socket.off('reconnect');

            const storageKey = getStorageKey(resolvedUserId);

            // Hàm xử lý join/request bên trong connect
            const handleConnectSync = () => {
                setConnected(true);
                const currentConvId =
                    conversationIdRef.current ||
                    localStorage.getItem(storageKey);

                if (!currentConvId) {
                    console.log(
                        '[SupportChat] Socket connected - No conversation, requesting waiter...'
                    );
                    socket.emit('customer:requestWaiter', {
                        customerName: resolvedName,
                        customerId: resolvedUserId || null,
                        tableNumber: null,
                    });
                } else {
                    console.log(
                        '[SupportChat] Socket connected - Rejoining conversation:',
                        currentConvId
                    );
                    socket.emit('customer:join', {
                        conversationId: currentConvId,
                        customerName: resolvedName,
                        customerId: resolvedUserId || null,
                    });
                }
            };

            socket.on('connect', handleConnectSync);

            // Nếu đã connect rồi mà register lại events, chạy luôn logic sync
            if (socket.connected) {
                handleConnectSync();
            }

            socket.on(
                'conversation:created',
                ({ conversationId, requestStatus: status, message }) => {
                    console.log(
                        '[SupportChat] Event conversation:created received:',
                        conversationId
                    );
                    conversationIdRef.current = conversationId;
                    localStorage.setItem(storageKey, conversationId);
                    setRequestStatus(status);
                    setMessages([]);
                }
            );

            socket.on(
                'conversation:joined',
                ({
                    conversationId,
                    messages: history,
                    status,
                    requestStatus: reqStatus,
                    assignedWaiterName: waiterName,
                }) => {
                    console.log(
                        '[SupportChat] Event conversation:joined received:',
                        conversationId
                    );
                    conversationIdRef.current = conversationId;
                    localStorage.setItem(storageKey, conversationId);
                    setMessages(history || []);
                    setIsClosed(status === 'closed');
                    setRequestStatus(reqStatus || 'waiting');
                    setAssignedWaiterName(waiterName || null);
                }
            );

            socket.on('waiter:joined', ({ waiterName, message }) => {
                setRequestStatus('active');
                setAssignedWaiterName(waiterName);
                setMessages((prev) => [
                    ...prev,
                    {
                        sender: 'system',
                        senderRole: 'system',
                        text:
                            message ||
                            `${waiterName} đã tham gia cuộc trò chuyện`,
                        createdAt: new Date(),
                    },
                ]);
            });

            socket.on('message:new', (msg) => {
                setMessages((prev) => {
                    const isDuplicate = prev.some((existingMsg) => {
                        // 1. Nếu có ID, check ID trước
                        if (msg._id && existingMsg._id === msg._id) return true;

                        // 2. Fallback: Check nội dung và thời gian (nới lỏng senderRole)
                        return (
                            existingMsg.text === msg.text &&
                            Math.abs(
                                new Date(existingMsg.createdAt) -
                                    new Date(msg.createdAt)
                            ) < 3000 // Giảm xuống 3s cho nhạy
                        );
                    });

                    if (isDuplicate) {
                        return prev.map((existingMsg) => {
                            // Cập nhật tin nhắn Optimistic bằng tin nhắn thật từ server (có ID)
                            const isMatch =
                                (msg._id && existingMsg._id === msg._id) ||
                                (existingMsg.text === msg.text &&
                                    existingMsg._isOptimistic);

                            return isMatch
                                ? { ...msg, _isOptimistic: false }
                                : existingMsg;
                        });
                    }

                    return [...prev, msg];
                });

                if (msg.senderRole === 'admin' || msg.senderRole === 'waiter')
                    setAdminTyping(false);
            });

            socket.on('admin:typing', () => {
                setAdminTyping(true);
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(
                    () => setAdminTyping(false),
                    3000
                );
            });

            socket.on('conversation:closed', () => setIsClosed(true));
            socket.on('disconnect', () => setConnected(false));
            socket.on('reconnect', () => {
                console.log(
                    '[SupportChat] Socket reconnected, re-triggering join...'
                );
                const currentConvId =
                    conversationIdRef.current ||
                    localStorage.getItem(storageKey);
                if (currentConvId) {
                    socket.emit('customer:join', {
                        conversationId: currentConvId,
                        customerName: resolvedName,
                        customerId: resolvedUserId || null,
                    });
                }
            });
        },
        []
    );

    // Connect and join function
    const connectAndJoin = useCallback(
        (name, userId) => {
            console.log('[SupportChat] connectAndJoin initiated for:', name);
            const socket = getSocket();
            socketRef.current = socket;

            registerSocketEvents(socket, name, userId);

            if (!socket.connected) {
                socket.connect();
            }
        },
        [registerSocketEvents]
    );

    // Handle auth state changes
    useEffect(() => {
        const currentUserId = user?._id || null;
        const prevUserId = prevUserIdRef.current;

        if (prevUserId === currentUserId) return;
        prevUserIdRef.current = currentUserId;

        if (currentUserId) {
            // User logged in
            conversationIdRef.current = null;
            setMessages([]);
            setIsClosed(false);
            setAdminTyping(false);
            setNameEntered(true);
            setGuestName('');
            setRequestStatus('waiting');
            setAssignedWaiterName(null);

            destroySocket();
            socketRef.current = null;
            setConnected(false);
        } else {
            // User logged out
            conversationIdRef.current = null;
            setMessages([]);
            setIsClosed(false);
            setNameEntered(false);
            setGuestName('');
            setRequestStatus('waiting');
            setAssignedWaiterName(null);

            localStorage.removeItem(GUEST_STORAGE_KEY);
            destroySocket();
            socketRef.current = null;
            setConnected(false);
        }
    }, [user?._id]);

    // ── AI Messages: load/save localStorage per user ──────────────────
    useEffect(() => {
        const userId = user?._id || null;
        // Only run when userId actually changes (including first mount undefined→value)
        if (prevAiUserIdRef.current === userId) return;
        prevAiUserIdRef.current = userId;

        const key = getAiStorageKey(userId);
        const tsKey = getAiTimestampKey(userId);
        try {
            // Guest TTL check — xóa history nếu quá hạn
            if (!userId && tsKey) {
                const savedTs = localStorage.getItem(tsKey);
                if (savedTs) {
                    const daysPassed =
                        (Date.now() - Number(savedTs)) / (1000 * 60 * 60 * 24);
                    if (daysPassed >= GUEST_AI_TTL_DAYS) {
                        console.log(
                            `[AI Chat] Guest history expired (${Math.floor(daysPassed)} days), clearing...`
                        );
                        localStorage.removeItem(key);
                        localStorage.removeItem(tsKey);
                        setAiMessages([{ role: 'bot', text: AI_GREETING }]);
                        return;
                    }
                }
            }

            const saved = localStorage.getItem(key);
            if (saved) {
                setAiMessages(JSON.parse(saved));
            } else {
                setAiMessages([{ role: 'bot', text: AI_GREETING }]);
            }
        } catch {
            setAiMessages([{ role: 'bot', text: AI_GREETING }]);
        }
    }, [user?._id]);

    useEffect(() => {
        const userId = user?._id || null;
        const key = getAiStorageKey(userId);
        const tsKey = getAiTimestampKey(userId);
        if (aiMessages.length > 1) {
            try {
                localStorage.setItem(
                    key,
                    JSON.stringify(aiMessages.slice(-50))
                );
                // Lưu timestamp cho guest để tính TTL
                if (!userId && tsKey && !localStorage.getItem(tsKey)) {
                    localStorage.setItem(tsKey, String(Date.now()));
                }
            } catch {
                // quota exceeded — ignore
            }
        }
    }, [aiMessages, user?._id]);

    // Send AI message
    const sendAIMessage = useCallback(
        async (text) => {
            const trimmed = text?.trim();
            if (!trimmed || aiLoading || aiCooldown > 0) return;

            const userId = user?._id || null;

            // ── Check Guest Limit ──────────────────
            if (!userId) {
                const countKey = getAiGuestLimitKey();
                const resetKey = getAiGuestLastResetKey();
                const now = new Date().toDateString();
                const lastReset = localStorage.getItem(resetKey);

                let count = parseInt(localStorage.getItem(countKey) || '0');

                // Reset nếu sang ngày mới
                if (lastReset !== now) {
                    count = 0;
                    localStorage.setItem(resetKey, now);
                }

                if (count >= GUEST_AI_LIMIT) {
                    const limitMsg = {
                        role: 'bot',
                        text: `⚠️ **Bạn đã hết lượt hỏi AI trong ngày hôm nay (giới hạn 10 câu).**\n\nĐăng nhập ngay để:\n• Tiếp tục trò chuyện không giới hạn 🚀\n• Lưu lịch sử hội thoại 📝\n• Tích điểm thưởng & nhận ưu đãi 🎁\n\nHoặc bạn có thể chọn **"Chat với nhân viên"** bên dưới để được hỗ trợ trực tiếp từ đội ngũ EatEase! 😊`,
                        isLimitReached: true, // Flag để UI có thể render nút login/staff chat
                    };
                    setAiMessages((prev) => [
                        ...prev,
                        { role: 'user', text: trimmed },
                        limitMsg,
                    ]);
                    return;
                }

                // Tăng count
                localStorage.setItem(countKey, (count + 1).toString());
            }

            const userMsg = { role: 'user', text: trimmed };
            setAiMessages((prev) => [...prev, userMsg]);
            setAiLoading(true);

            try {
                // history = all messages after greeting, before the one we just added
                const history = [];
                setAiMessages((prev) => {
                    const msgs = prev.slice(1, -1); // exclude greeting + last user msg
                    msgs.forEach((m) =>
                        history.push({ role: m.role, text: m.text })
                    );
                    return prev; // no change
                });

                const response = await Axios({
                    ...SummaryApi.chat_message,
                    data: { message: trimmed, history },
                });

                if (response.data?.success) {
                    setAiMessages((prev) => [
                        ...prev,
                        { role: 'bot', text: response.data.data.reply },
                    ]);
                }
            } catch (error) {
                setAiMessages((prev) => [
                    ...prev,
                    {
                        role: 'bot',
                        text:
                            error?.response?.data?.message ||
                            'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau ít phút! 🙏',
                    },
                ]);
            } finally {
                setAiLoading(false);
                // 5-second cooldown
                setAiCooldown(5);
                clearInterval(aiCooldownRef.current);
                aiCooldownRef.current = setInterval(() => {
                    setAiCooldown((prev) => {
                        if (prev <= 1) {
                            clearInterval(aiCooldownRef.current);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
        },
        [aiLoading, aiCooldown]
    );

    // Clear AI chat history
    const clearAiMessages = useCallback(() => {
        const userId = user?._id || null;
        const key = getAiStorageKey(userId);
        const tsKey = getAiTimestampKey(userId);
        localStorage.removeItem(key);
        if (tsKey) localStorage.removeItem(tsKey);
        setAiMessages([{ role: 'bot', text: AI_GREETING }]);
    }, [user?._id]);

    // Cleanup
    useEffect(() => {
        return () => {
            clearTimeout(typingTimeoutRef.current);
            clearInterval(aiCooldownRef.current);
            if (socketRef.current) {
                socketRef.current.off('connect');
                socketRef.current.off('conversation:created');
                socketRef.current.off('conversation:joined');
                socketRef.current.off('waiter:joined');
                socketRef.current.off('message:new');
                socketRef.current.off('admin:typing');
                socketRef.current.off('conversation:closed');
                socketRef.current.off('disconnect');
                socketRef.current.off('reconnect');
            }
        };
    }, []);

    // Initialize connection for logged-in users
    const initializeConnection = useCallback(async () => {
        const isLoggedIn = !!user?._id;
        const shouldConnect = isLoggedIn || nameEntered;

        if (!shouldConnect) return;

        const name = isLoggedIn ? user.name || 'Khách' : guestName;
        const userId = isLoggedIn ? user._id : null;

        // ── Logged-in user: kiểm tra conversation cũ trên server trước ───────────────
        if (isLoggedIn) {
            try {
                const res = await Axios({
                    ...SummaryApi.get_my_support_conversation,
                });
                const existing = res.data?.data;

                if (existing?.conversationId) {
                    // Có conversation cũ → lưu TTL info và join lại
                    setChatExpiresAt(existing.expiresAt);
                    setChatDaysLeft(existing.daysLeft);
                    conversationIdRef.current = existing.conversationId;
                    // Lưu lại vào localStorage cho lần sau
                    localStorage.setItem(
                        getStorageKey(userId),
                        existing.conversationId
                    );
                    connectAndJoin(name, userId);
                    return;
                }
            } catch (err) {
                console.warn(
                    '[SupportChat] Could not check existing conversation:',
                    err.message
                );
                // Nếu API lỗi, thử với localStorage fallback bình thường
            }

            // Không có conversation cũ → tạo mới (fresh)
            conversationIdRef.current = null;
            localStorage.removeItem(getStorageKey(userId));
            destroySocket();
            socketRef.current = null;
            setConnected(false);
            setMessages([]);
            setIsClosed(false);
            setAdminTyping(false);
            setRequestStatus('waiting');
            setAssignedWaiterName(null);
            setChatExpiresAt(null);
            setChatDaysLeft(null);
        } else {
            // Guest: chỉ dùng localStorage
            const storageKey = getStorageKey(null);
            const savedConvId = localStorage.getItem(storageKey);
            if (savedConvId) {
                conversationIdRef.current = savedConvId;
            }
        }

        connectAndJoin(name, userId);
    }, [user, nameEntered, guestName, connectAndJoin]);

    // Submit guest name
    const submitGuestName = useCallback(
        (name) => {
            if (!name.trim()) return;

            console.log(
                '[SupportChat] submitGuestName called with name:',
                name
            );
            setGuestName(name.trim());
            setNameEntered(true);

            // Clear existing conversation to force new request
            conversationIdRef.current = null;
            localStorage.removeItem(GUEST_STORAGE_KEY);

            destroySocket();
            socketRef.current = null;
            setConnected(false);

            setMessages([]);
            setIsClosed(false);
            setAdminTyping(false);
            setRequestStatus('waiting');
            setAssignedWaiterName(null);

            console.log('[SupportChat] Cleared all state, starting fresh chat');
            connectAndJoin(name.trim(), null);
        },
        [connectAndJoin]
    );

    // Send message
    const sendMessage = useCallback(
        (text) => {
            if (!text.trim() || isClosed) return;

            const socket = socketRef.current;
            if (!socket || !socket.connected) {
                console.warn(
                    '[SupportChat] Socket not connected, trying to reconnect...'
                );
                initializeConnection();
                return;
            }

            const name = user?._id
                ? user.name || 'Khách'
                : guestName || 'Khách';
            const userId = user?._id || null;

            // Nếu CHƯA có conversationId (lỗi auto-request hoặc do user gõ tin nhắn đầu tiên)
            if (!conversationIdRef.current) {
                console.log(
                    '[SupportChat] No conversationId, forcing requestWaiter before sending message'
                );
                socket.emit('customer:requestWaiter', {
                    customerName: name,
                    customerId: userId,
                    tableNumber: null,
                });

                // Lắng nghe sự kiện created để gửi tin nhắn ngay sau đó
                socket.once('conversation:created', ({ conversationId }) => {
                    console.log(
                        '[SupportChat] Conversation created for pending message:',
                        conversationId
                    );
                    socket.emit('customer:message', {
                        conversationId: conversationId,
                        text: text.trim(),
                        senderName: name,
                    });
                });
            } else {
                // Đã có conversationId, gửi bình thường
                socket.emit('customer:message', {
                    conversationId: conversationIdRef.current,
                    text: text.trim(),
                    senderName: name,
                });
            }

            // Optimistic update để UI hiện ngay lập tức
            const optimisticMsg = {
                sender: socket.id,
                senderName: name,
                senderRole: 'customer',
                text: text.trim(),
                createdAt: new Date(),
                _isOptimistic: true,
            };
            setMessages((prev) => [...prev, optimisticMsg]);
        },
        [user, guestName, isClosed, initializeConnection]
    );

    // Start new chat
    const startNewChat = useCallback(() => {
        const storageKey = getStorageKey(user?._id || null);
        localStorage.removeItem(storageKey);
        conversationIdRef.current = null;

        destroySocket();
        socketRef.current = null;
        setConnected(false);

        setMessages([]);
        setIsClosed(false);
        setAdminTyping(false);
        setRequestStatus('waiting');
        setAssignedWaiterName(null);

        if (!user?._id) {
            setNameEntered(false);
            setGuestName('');
        } else {
            connectAndJoin(user.name || 'Khách', user._id);
        }
    }, [user, connectAndJoin]);

    const value = {
        // Support chat state
        messages,
        connected,
        isClosed,
        adminTyping,
        requestStatus,
        assignedWaiterName,
        nameEntered,
        guestName,
        conversationId: conversationIdRef.current,
        chatExpiresAt, // Date object - khi nào hết hạn
        chatDaysLeft, // number - còn bao nhiêu ngày

        // Support chat actions
        initializeConnection,
        submitGuestName,
        sendMessage,
        startNewChat,

        // AI chat state
        aiMessages,
        aiLoading,
        aiCooldown,

        // AI chat actions
        sendAIMessage,
        clearAiMessages,

        // Computed
        customerName: user?.name || guestName || 'Khách',
        showNameForm: !nameEntered && !user?._id,
    };

    return (
        <SupportChatContext.Provider value={value}>
            {children}
        </SupportChatContext.Provider>
    );
};
