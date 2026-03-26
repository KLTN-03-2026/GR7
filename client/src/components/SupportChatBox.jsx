import { useState, useRef, useEffect } from 'react';
import {
    MessageCircle,
    X,
    Send,
    ChevronDown,
    Headphones,
    Wifi,
    WifiOff,
    Maximize,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupportChat } from '../contexts/SupportChatContext';

function ChatBubble({ msg }) {
    // Handle system messages
    if (msg.senderRole === 'system') {
        return (
            <div className="flex justify-center mb-3">
                <div className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
                    {msg.text}
                </div>
            </div>
        );
    }
    
    const isUser = msg.senderRole === 'customer';
    return (
        <div
            className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end mb-3`}
        >
            {!isUser && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow">
                    <Headphones size={13} className="text-white" />
                </div>
            )}
            <div
                className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    isUser
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-700'
                }`}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
                {msg.text}
            </div>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex gap-2 items-end mb-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow">
                <Headphones size={13} className="text-white" />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((d) => (
                        <span
                            key={d}
                            className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${d}ms` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SupportChatBox() {
    const {
        messages,
        connected,
        isClosed,
        adminTyping,
        requestStatus,
        assignedWaiterName,
        nameEntered,
        guestName,
        customerName,
        showNameForm,
        initializeConnection,
        submitGuestName,
        sendMessage,
        startNewChat,
    } = useSupportChat();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [tempGuestName, setTempGuestName] = useState('');

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) scrollToBottom();
    }, [messages, isOpen, isMinimized]);

    useEffect(() => {
        if (isOpen && !isMinimized) {
            setHasNewMessage(false);
            inputRef.current?.focus();
        }
    }, [isOpen, isMinimized]);

    // Monitor for new messages when chat is closed/minimized
    useEffect(() => {
        if ((!isOpen || isMinimized) && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.senderRole === 'admin' || lastMessage.senderRole === 'waiter') {
                setHasNewMessage(true);
            }
        }
    }, [messages, isOpen, isMinimized]);

    const handleOpen = () => {
        console.log('[SupportChatBox] handleOpen called');
        setIsOpen(true);
        setIsMinimized(false);
        setHasNewMessage(false);
        
        // Initialize connection when opening chat
        initializeConnection();
    };

    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (!tempGuestName.trim()) return;
        
        console.log('[SupportChatBox] handleNameSubmit called with name:', tempGuestName);
        submitGuestName(tempGuestName.trim());
        setTempGuestName('');
    };

    const handleSend = () => {
        const text = input.trim();
        if (!text) return;
        
        sendMessage(text);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewChat = () => {
        startNewChat();
        setInput('');
    };

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={handleOpen}
                    className="fixed bottom-6 right-24 z-50 w-14 h-14 rounded-full
                               bg-gradient-to-br from-emerald-400 to-teal-600
                               text-white shadow-2xl shadow-teal-500/40 hover:shadow-teal-500/60
                               flex items-center justify-center cursor-pointer
                               hover:scale-110 active:scale-95 transition-all duration-200"
                    title="Chat với Shop"
                >
                    <MessageCircle size={26} />
                    {hasNewMessage && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div
                    className={`fixed bottom-6 right-24 z-50 w-[360px] rounded-2xl shadow-2xl shadow-black/20
                                border border-white/10 overflow-hidden transition-all duration-300
                                ${isMinimized ? 'h-14' : 'h-[520px]'}
                                flex flex-col bg-gray-50 dark:bg-gray-900`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                <Headphones size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-white font-semibold text-sm leading-tight">
                                    Hỗ trợ trực tiếp
                                </p>
                                <div className="flex items-center gap-1">
                                    {connected ? (
                                        <>
                                            <Wifi
                                                size={9}
                                                className="text-green-300"
                                            />
                                            <p className="text-emerald-100 text-[11px]">
                                                Đang kết nối
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff
                                                size={9}
                                                className="text-red-300"
                                            />
                                            <p className="text-red-200 text-[11px]">
                                                Mất kết nối
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Link
                                to={'/dashboard/chat-support-customer'}
                                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
                                title="Mở rộng"
                            >
                                <Maximize size={16} />
                            </Link>
                            <button
                                onClick={() => setIsMinimized(true)}
                                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
                            >
                                <ChevronDown size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsMinimized(false);
                                }}
                                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Minimized bar */}
                    {isMinimized && (
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-sm gap-1"
                        >
                            <MessageCircle size={13} /> Tiếp tục hỗ trợ
                        </button>
                    )}

                    {!isMinimized && (
                        <>
                            {/* Name form for guests */}
                            {showNameForm ? (
                                <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg">
                                        <Headphones
                                            size={30}
                                            className="text-white"
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-gray-800 dark:text-gray-100">
                                            Chat với Shop
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Vui lòng cho chúng tôi biết tên bạn
                                        </p>
                                    </div>
                                    <form
                                        onSubmit={handleNameSubmit}
                                        className="w-full flex flex-col gap-3"
                                    >
                                        <input
                                            value={tempGuestName}
                                            onChange={(e) =>
                                                setTempGuestName(e.target.value)
                                            }
                                            placeholder="Nhập tên của bạn..."
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-teal-400 transition"
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium cursor-pointer hover:opacity-90 transition"
                                        >
                                            Bắt đầu chat
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <>
                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto px-3 pt-4 pb-2 scroll-smooth">
                                        {/* Waiting status banner */}
                                        {requestStatus === 'waiting' && (
                                            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                                    <p className="text-xs font-medium">
                                                        Đang chờ nhân viên phục vụ...
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Assigned status banner */}
                                        {(requestStatus === 'assigned' || requestStatus === 'active') && assignedWaiterName && (
                                            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                                                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                                    <p className="text-xs font-medium">
                                                        {assignedWaiterName} đang hỗ trợ bạn
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {messages.length === 0 && requestStatus !== 'waiting' && (
                                            <div className="text-center text-sm text-gray-400 mt-6">
                                                <p>
                                                    👋 Xin chào {customerName}!
                                                </p>
                                                <p className="mt-1">
                                                    Nhân viên sẽ phản hồi sớm
                                                    nhất có thể.
                                                </p>
                                            </div>
                                        )}
                                        {messages.map((msg, i) => (
                                            <ChatBubble key={i} msg={msg} />
                                        ))}
                                        {adminTyping && <TypingIndicator />}
                                        {isClosed && (
                                            <div className="text-center py-3 border-t border-gray-100 dark:border-gray-800 mt-2 flex flex-col items-center gap-2">
                                                <p className="text-xs text-gray-400">
                                                    Hội thoại đã được đóng. Cảm
                                                    ơn bạn đã liên hệ!
                                                </p>
                                                <button
                                                    onClick={handleNewChat}
                                                    className="px-4 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 active:scale-95 transition cursor-pointer shadow-md shadow-teal-500/30"
                                                >
                                                    ✨ Bắt đầu chat mới
                                                </button>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input */}
                                    <div className="px-3 pb-3 pt-2 flex-shrink-0 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                                        {isClosed ? (
                                            <button
                                                onClick={handleNewChat}
                                                className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium cursor-pointer hover:opacity-90 active:scale-[0.98] transition shadow-md shadow-teal-500/30"
                                            >
                                                ✨ Bắt đầu chat mới
                                            </button>
                                        ) : (
                                            <div className="flex items-end gap-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 shadow-sm">
                                                <textarea
                                                    ref={inputRef}
                                                    value={input}
                                                    onChange={(e) =>
                                                        setInput(e.target.value)
                                                    }
                                                    onKeyDown={handleKeyDown}
                                                    placeholder="Nhập tin nhắn..."
                                                    rows={1}
                                                    disabled={!connected}
                                                    className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none leading-relaxed max-h-24 overflow-y-auto"
                                                />
                                                <button
                                                    onClick={handleSend}
                                                    disabled={
                                                        !input.trim() ||
                                                        !connected
                                                    }
                                                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95 cursor-pointer shadow"
                                                >
                                                    <Send size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-1.5">
                                            Phản hồi trong vòng vài phút
                                        </p>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}
