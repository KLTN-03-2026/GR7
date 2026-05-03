import { useEffect, useState, FC } from 'react';
import {
    useNavigate,
    useSearchParams,
} from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import AxiosToastError from '@/utils/AxiosToastError';
import BorderGlow from '../animations/BorderGlow';
import { Button } from '../ui/button';

const VerifyEmailForm: FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isSuccess, setIsSuccess] = useState(false);
    const [message, setMessage] = useState('Đang xác nhận email của bạn...');

    useEffect(() => {
        const verifyEmail = async () => {
            const code = searchParams.get('code');

            if (!code) {
                setMessage('Thiếu mã xác nhận');
                setIsLoading(false);
                setIsSuccess(false);
                return;
            }

            try {
                const response = await Axios({
                    ...SummaryApi.verifyEmail,
                    data: { code },
                });

                if (response.data.success) {
                    setMessage(
                        'Xác nhận email thành công! Bạn sẽ được chuyển đến trang đăng nhập trong giây lát...'
                    );
                    setIsSuccess(true);

                    // Redirect to login after 3 seconds
                    setTimeout(() => {
                        navigate('/login', { replace: true });
                    }, 3000);
                } else {
                    setMessage(
                        response.data.message ||
                            'Có lỗi xảy ra khi xác nhận email'
                    );
                    setIsSuccess(false);
                }
            } catch (error) {
                const errorMessage =
                    error.response?.data?.message ||
                    'Đã xảy ra lỗi khi xác nhận email';
                setMessage(errorMessage);
                setIsSuccess(false);
                AxiosToastError(error);
            } finally {
                setIsLoading(false);
            }
        };

        verifyEmail();
    }, [searchParams, navigate]);

    return (
        <div className="flex items-center justify-center text-foreground font-semibold">
            <div className="max-w-xl w-full space-y-8 p-8 bg-card/50 backdrop-blur-sm rounded-2xl border border-border shadow-xl">
                {isLoading ? (
                    <div className="text-center space-y-6">
                        <div className="flex justify-center">
                            <FaSpinner className="h-16 w-16 animate-spin" style={{ color: '#C96048' }} />
                        </div>
                        <p className="text-lg text-muted-foreground">{message}</p>
                    </div>
                ) : isSuccess ? (
                    <div className="text-center space-y-6">
                        {/* Success Icon */}
                        <div className="flex justify-center">
                            <div className="rounded-full p-4" style={{ backgroundColor: 'rgba(201, 96, 72, 0.1)' }}>
                                <FaCheckCircle className="h-16 w-16" style={{ color: '#C96048' }} />
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-3xl font-bold" style={{ color: '#C96048' }}>
                            Xác nhận thành công!
                        </h2>

                        {/* Message */}
                        <p className="text-base text-foreground">
                            {message}
                        </p>
                    </div>
                ) : (
                    <div className="text-center space-y-6">
                        {/* Error Icon */}
                        <div className="flex justify-center">
                            <div className="rounded-full p-4 bg-red-100">
                                <FaTimesCircle className="h-16 w-16 text-red-600" />
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-3xl font-bold text-red-600">
                            Xác nhận không thành công
                        </h2>

                        {/* Message */}
                        <p className="text-base text-muted-foreground">
                            {message}
                        </p>

                        {/* Back Button */}
                        <div className="pt-4">
                            <BorderGlow
                                borderColor="#C96048"
                                glowColor="#d97a66"
                                animated={true}
                                className="rounded-lg"
                            >
                                <Button
                                    onClick={() => navigate('/register')}
                                    className="w-full h-12 font-bold text-white text-base"
                                    style={{
                                        background: 'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                                    }}
                                >
                                    Quay lại trang đăng ký
                                </Button>
                            </BorderGlow>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmailForm;
