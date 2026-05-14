import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import Axios from '../utils/Axios';
import toast from 'react-hot-toast';
import { FiUser, FiPhone, FiArrowRight, FiSkipForward, FiStar, FiLock, FiUserPlus, FiLogIn } from 'react-icons/fi';
import { MdOutlineQrCodeScanner } from 'react-icons/md';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../store/userSlice';

export default function CustomerCheckinPage() {
    const { theme } = useTheme();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const tableId = searchParams.get('tableId') || '';
    const tableNumber = decodeURIComponent(searchParams.get('tableNumber') || '');
    
    const [mode, setMode] = useState('choice'); // 'choice', 'login', 'register'
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ name: '', mobile: '', password: '' });

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSkip = () => {
        // Tiếp tục với tư cách Guest (đã có Token TABLE từ TableLoginPage)
        navigate(`/table-menu`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = mode === 'login' ? '/api/table-auth/link-customer' : '/api/table-auth/quick-register';
            const res = await Axios.post(url, { ...form, tableId });

            if (res.data.success) {
                // Lưu token mới (Token CUSTOMER)
                localStorage.setItem('accessToken', res.data.data.accessToken);
                // Cập nhật Redux
                dispatch(setUserDetails(res.data.data.user));
                
                toast.success(mode === 'login' ? `Chào mừng trở lại, ${res.data.data.user.name}!` : 'Đăng ký thành viên thành công! 🎉');
                navigate(`/table-menu`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background dark:bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-card dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-border">
                    {/* Header Section */}
                    <div className="px-6 py-8 text-white text-center" style={{ background: 'linear-gradient(135deg, #C96048 0%, #d97a66 100%)' }}>
                        <div className="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <MdOutlineQrCodeScanner className="text-white text-4xl" />
                        </div>
                        <h1 className="text-2xl font-bold italic">EatEase Restaurant</h1>
                        {tableNumber && (
                            <div className="inline-block bg-white/20 text-white text-sm font-semibold px-4 py-1 rounded-full mt-2">
                                🪑 Bàn {tableNumber}
                            </div>
                        )}
                    </div>

                    <div className="p-6">
                        {mode === 'choice' && (
                            <div className="space-y-4">
                                <div className="text-center mb-6">
                                    <h2 className="text-xl font-bold">Lựa chọn của bạn?</h2>
                                    <p className="text-muted-foreground text-sm mt-1">Để có trải nghiệm tốt nhất tại nhà hàng</p>
                                </div>

                                {/* Option 1: Guest */}
                                <button 
                                    onClick={handleSkip}
                                    className="w-full group flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-[#C96048] hover:bg-[#C96048]/5 transition-all duration-200"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl group-hover:bg-[#C96048] group-hover:text-white transition-colors">
                                        <FiSkipForward />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold">Khách vãng lai</p>
                                        <p className="text-xs text-muted-foreground">Xem menu và gọi món ngay (không tích điểm)</p>
                                    </div>
                                    <FiArrowRight className="ml-auto text-muted-foreground group-hover:text-[#C96048]" />
                                </button>

                                {/* Option 2: Login */}
                                <button 
                                    onClick={() => setMode('login')}
                                    className="w-full group flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-[#C96048] hover:bg-[#C96048]/5 transition-all duration-200"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl group-hover:bg-[#C96048] group-hover:text-white transition-colors">
                                        <FiLogIn />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold">Đã có tài khoản</p>
                                        <p className="text-xs text-muted-foreground">Đăng nhập để nhận ưu đãi thành viên</p>
                                    </div>
                                    <FiArrowRight className="ml-auto text-muted-foreground group-hover:text-[#C96048]" />
                                </button>

                                {/* Option 3: Register */}
                                <button 
                                    onClick={() => setMode('register')}
                                    className="w-full group flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-[#C96048] hover:bg-[#C96048]/5 transition-all duration-200"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl group-hover:bg-[#C96048] group-hover:text-white transition-colors">
                                        <FiUserPlus />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-[#C96048]">Đăng ký thành viên</p>
                                        <p className="text-xs text-muted-foreground">Tích điểm đổi quà & nhận ưu đãi hạng Tier</p>
                                    </div>
                                    <FiArrowRight className="ml-auto text-muted-foreground group-hover:text-[#C96048]" />
                                </button>

                                <div className="pt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <FiStar className="text-yellow-500" />
                                    <span>Tích lũy 10.000đ = 1 điểm thưởng</span>
                                </div>
                            </div>
                        )}

                        {mode !== 'choice' && (
                            <div className="space-y-6">
                                <button 
                                    onClick={() => setMode('choice')}
                                    className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                    ← Quay lại lựa chọn
                                </button>

                                <div className="text-center">
                                    <h2 className="text-xl font-bold">{mode === 'login' ? 'Đăng nhập thành viên' : 'Đăng ký thành viên mới'}</h2>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        {mode === 'login' ? 'Nhập thông tin tài khoản của bạn' : 'Chỉ mất 30 giây để bắt đầu tích điểm'}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {mode === 'register' && (
                                        <div className="relative">
                                            <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="text"
                                                name="name"
                                                required
                                                value={form.name}
                                                onChange={handleChange}
                                                placeholder="Họ và tên"
                                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#C96048]/20 transition"
                                            />
                                        </div>
                                    )}
                                    <div className="relative">
                                        <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="tel"
                                            name="mobile"
                                            required
                                            value={form.mobile}
                                            onChange={handleChange}
                                            placeholder="Số điện thoại"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#C96048]/20 transition"
                                        />
                                    </div>
                                    <div className="relative">
                                        <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            value={form.password}
                                            onChange={handleChange}
                                            placeholder="Mật khẩu"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#C96048]/20 transition"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-4 bg-[#C96048] hover:bg-[#b55540] text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                {mode === 'login' ? 'Xác thực tài khoản' : 'Hoàn tất đăng ký'}
                                                <FiArrowRight />
                                            </>
                                        )}
                                    </button>
                                </form>

                                <p className="text-center text-xs text-muted-foreground px-4">
                                    Bằng việc tiếp tục, bạn đồng ý với chính sách bảo mật và điều khoản sử dụng của EatEase.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
