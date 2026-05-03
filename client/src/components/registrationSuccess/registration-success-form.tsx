import { useEffect, useState, FC } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    FaCheckCircle,
    FaEnvelope,
    FaArrowRight,
    FaHome,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import BorderGlow from '../animations/BorderGlow';
import { Button } from '../ui/button';

interface LocationState {
    email?: string;
}

const RegistrationSuccessForm: FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [email, setEmail] = useState<string>('');

    useEffect(() => {
        const state = location.state as LocationState | null;
        if (state?.email) {
            setEmail(state.email);
        } else {
            toast.error('Không tìm thấy thông tin đăng ký');
            navigate('/register');
        }
    }, [location.state, navigate]);

    if (!email) {
        return null;
    }

    return (
        <div className="flex items-center justify-center text-foreground font-semibold">
            <div className="max-w-2xl w-full space-y-8 p-8 bg-card/50 backdrop-blur-sm rounded-2xl border border-border shadow-xl">
                <div className="text-center space-y-6">
                    {/* Success Icon */}
                    <div className="flex justify-center">
                        <div className="rounded-full p-4" style={{ backgroundColor: 'rgba(201, 96, 72, 0.1)' }}>
                            <FaCheckCircle className="h-16 w-16" style={{ color: '#C96048' }} />
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl font-bold" style={{ color: '#C96048' }}>
                        Đăng ký thành công!
                    </h2>

                    {/* Email Info */}
                    <div className="space-y-4 text-base">
                        <p className="flex items-center justify-center gap-2 text-muted-foreground">
                            <FaEnvelope className="mb-0.5" />
                            Vui lòng kiểm tra email của bạn
                        </p>
                        <p className="text-foreground">
                            Chúng tôi đã gửi một liên kết xác nhận đến:
                            <span className="block font-bold mt-2 text-lg" style={{ color: '#C96048' }}>
                                {email}
                            </span>
                        </p>
                        <p className="text-muted-foreground">
                            Vui lòng kiểm tra hộp thư đến và nhấp vào liên kết
                            xác nhận để kích hoạt tài khoản của bạn.
                        </p>

                        {/* Note Box */}
                        <div className="py-4 px-4 bg-background/80 rounded-lg text-sm border border-border">
                            <p className="font-bold mb-2" style={{ color: '#C96048' }}>Lưu ý:</p>
                            <ul className="space-y-2 text-muted-foreground text-left list-disc list-inside">
                                <li>
                                    Kiểm tra thư mục thư rác/spam nếu bạn không
                                    thấy email trong hộp thư đến
                                </li>
                                <li>Liên kết xác nhận sẽ hết hạn sau 24 giờ</li>
                            </ul>
                        </div>
                    </div>

                    {/* Resend Email */}
                    <div className="text-center text-sm">
                        <span className="text-muted-foreground">Không nhận được email? </span>
                        <button
                            className="font-semibold hover:opacity-80 transition-opacity hover:underline"
                            style={{ color: '#C96048' }}
                            onClick={() => {
                                // TODO: Implement resend verification email
                                toast.error('Chức năng gửi lại email xác nhận sẽ được triển khai sau');
                            }}
                        >
                            Gửi lại
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <BorderGlow
                            borderColor="#C96048"
                            glowColor="#d97a66"
                            animated={true}
                            className="rounded-lg"
                        >
                            <Link to="/">
                                <Button
                                    className="w-full h-12 font-bold text-white text-base flex items-center justify-center gap-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                                    }}
                                >
                                    <FaHome size={16} />
                                    Về trang chủ
                                </Button>
                            </Link>
                        </BorderGlow>

                        <BorderGlow
                            borderColor="#C96048"
                            glowColor="#d97a66"
                            animated={true}
                            className="rounded-lg"
                        >
                            <Link to="/login">
                                <Button
                                    className="w-full h-12 font-bold text-white text-base flex items-center justify-center gap-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                                    }}
                                >
                                    Đăng nhập
                                    <FaArrowRight size={16} />
                                </Button>
                            </Link>
                        </BorderGlow>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistrationSuccessForm;
