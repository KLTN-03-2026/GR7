import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const user = useSelector((state) => state.user);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        // Chờ 3 giây để Redux phục hồi user từ Cookie (nếu có)
        const timer = setTimeout(() => {
            setIsChecking(false);
        }, 3000);

        // Nếu user đã load xong trước 3 giây thì tắt Loading ngay
        if (user?._id) {
            setIsChecking(false);
            clearTimeout(timer);
        }

        return () => clearTimeout(timer);
    }, [user]);

    if (isChecking && !user?._id) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-gray-500 animate-pulse">Đang xác thực bàn của bạn...</p>
                </div>
            </div>
        );
    }

    if (!user?._id) {
        // Nếu sau 3 giây vẫn không có user thì mới đá về Home
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
