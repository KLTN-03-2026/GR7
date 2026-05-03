import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import GlareHover from '../GlareHover';
import { FaFacebookSquare } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import toast from 'react-hot-toast';
import fetchUserDetails from '@/utils/fetchUserDetails';
import { setUserDetails } from '@/store/userSlice';
import AxiosToastError from '@/utils/AxiosToastError';
import Loading from '../Loading';
import { useGoogleLogin } from '@react-oauth/google';
import FacebookLogin from '@greatsumini/react-facebook-login';
import { FaGoogle } from 'react-icons/fa';
import { getRoleHomePath } from '@/utils/routePermissions';
import BorderGlow from '../animations/BorderGlow';
import ShinyText from '../animations/ShinyText';
import { useTheme } from 'next-themes';

export function LoginForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'form'>) {
    const [data, setData] = useState({
        email: '',
        password: '',
    });

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [facebookLoading, setFacebookLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setData((prev) => ({ ...prev, [name]: value }));
    };

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
        const validTLDs = [
            'com',
            'net',
            'org',
            'io',
            'co',
            'ai',
            'vn',
            'com.vn',
            'edu.vn',
            'gov.vn',
        ];
        if (!emailRegex.test(email)) return false;
        const domain = email.split('@')[1];
        const tld = domain.split('.').slice(1).join('.');
        if (!validTLDs.includes(tld)) return false;
        if (
            email.includes('..') ||
            email.startsWith('.') ||
            email.endsWith('.') ||
            email.split('@')[0].endsWith('.')
        )
            return false;
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!data.email && !data.password) {
            toast.error('Vui lòng nhập đầy đủ thông tin.');
            return;
        }
        if (!data.email) {
            toast.error('Vui lòng nhập email');
            return;
        } else if (!validateEmail(data.email)) {
            toast.error('Vui lòng nhập địa chỉ email hợp lệ');
            return;
        }
        if (!data.password) {
            toast.error('Vui lòng nhập mật khẩu');
            return;
        }

        try {
            setLoading(true);
            const response = await Axios({ ...SummaryApi.login, data });

            if (response.data.error) {
                toast.error(response.data.message);
            }

            if (response.data.success) {
                toast.success(response.data.message);
                localStorage.setItem(
                    'accesstoken',
                    response.data.data.accessToken
                );
                localStorage.setItem(
                    'refreshToken',
                    response.data.data.refreshToken
                );

                const userDetails = await fetchUserDetails();
                dispatch(setUserDetails(userDetails.data));
                setData({ email: '', password: '' });
                navigate(getRoleHomePath(userDetails.data?.role));
            }
        } catch (error) {
            AxiosToastError(error);
        } finally {
            setLoading(false);
        }
    };

    // Google OAuth — dùng useGoogleLogin (implicit flow) + custom button
    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                setGoogleLoading(true);
                const response = await Axios({
                    ...SummaryApi.google_login,
                    data: { accessToken: tokenResponse.access_token },
                });

                if (response.data.error) {
                    toast.error(response.data.message);
                    return;
                }

                if (response.data.success) {
                    toast.success(response.data.message);
                    localStorage.setItem(
                        'accesstoken',
                        response.data.data.accessToken
                    );
                    localStorage.setItem(
                        'refreshToken',
                        response.data.data.refreshToken
                    );
                    const userDetails = await fetchUserDetails();
                    dispatch(setUserDetails(userDetails.data));
                    navigate(getRoleHomePath(userDetails.data?.role));
                }
            } catch (error) {
                AxiosToastError(error);
            } finally {
                setGoogleLoading(false);
            }
        },
        onError: () => {
            toast.error('Đăng nhập Google thất bại. Vui lòng thử lại.');
            setGoogleLoading(false);
        },
        flow: 'implicit',
    });

    return (
        <form
            className={cn(
                'flex flex-col gap-6 font-semibold text-foreground',
                className
            )}
            {...props}
            onSubmit={handleSubmit}
        >
            {/* Form Fields */}
            <div className="grid gap-5">
                {/* Email Field */}
                <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-semibold">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        name="email"
                        autoFocus
                        placeholder="your@email.com"
                        onChange={handleChange}
                        value={data.email}
                        className="h-12 border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors"
                    />
                </div>

                {/* Password Field */}
                <div className="grid gap-2">
                    <Label htmlFor="password" className="text-sm font-semibold">
                        Mật khẩu
                    </Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            placeholder="Nhập mật khẩu của bạn"
                            onChange={handleChange}
                            value={data.password}
                            className="h-12 pr-10 border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors"
                        />
                        <button
                            type="button"
                            className="absolute right-0 top-0 h-full px-3 py-0 cursor-pointer"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            ) : (
                                <Eye className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Remember & Forgot Password */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="remember"
                            className="rounded border-gray-300 cursor-pointer w-4 h-4"
                            style={{
                                accentColor: '#C96048',
                            }}
                        />
                        <Label
                            htmlFor="remember"
                            className="cursor-pointer hover:opacity-80 transition-opacity text-muted-foreground font-medium"
                        >
                            Ghi nhớ đăng nhập
                        </Label>
                    </div>
                    <Link
                        to={'/forgot-password'}
                        className="p-0 h-auto hover:opacity-80 cursor-pointer transition-opacity font-semibold"
                        style={{ color: '#C96048' }}
                    >
                        Quên mật khẩu?
                    </Link>
                </div>

                {/* Login Button with BorderGlow */}
                <BorderGlow
                    borderWidth={2}
                    borderColor="#C96048"
                    glowColor="#d97a66"
                    animated={true}
                    animationDuration={3}
                    className="rounded-lg mt-2"
                >
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 md:h-14 font-bold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] text-white text-base"
                        style={{
                            background:
                                'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                        }}
                    >
                        {loading ? <Loading /> : 'Đăng nhập'}
                    </Button>
                </BorderGlow>

                {/* Divider */}
                <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 border-t border-gray-400"></div>
                    <span className="text-orange-200 text-xs font-semibold whitespace-nowrap">
                        HOẶC TIẾP TỤC VỚI
                    </span>
                    <div className="flex-1 border-t border-gray-400"></div>
                </div>

                {/* Social Login Buttons */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Google Button */}
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 h-12 border-2 border-muted-foreground/30 rounded-lg cursor-pointer bg-background/50 hover:bg-muted/50 hover:border-[#C96048] transition-all active:scale-95 font-semibold"
                        onClick={() => {
                            setGoogleLoading(true);
                            googleLogin();
                        }}
                        disabled={googleLoading}
                    >
                        {googleLoading ? (
                            <Loading />
                        ) : (
                            <>
                                <FaGoogle className="text-red-500 text-lg" />
                                <span>Google</span>
                            </>
                        )}
                    </Button>

                    {/* Facebook Button */}
                    <FacebookLogin
                        appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
                        onSuccess={async (response) => {
                            try {
                                setFacebookLoading(true);
                                const loginRes = await Axios({
                                    ...SummaryApi.facebook_login,
                                    data: {
                                        accessToken: response.accessToken,
                                    },
                                });

                                if (loginRes.data.error) {
                                    toast.error(loginRes.data.message);
                                    return;
                                }

                                if (loginRes.data.success) {
                                    toast.success(loginRes.data.message);
                                    localStorage.setItem(
                                        'accesstoken',
                                        loginRes.data.data.accessToken
                                    );
                                    localStorage.setItem(
                                        'refreshToken',
                                        loginRes.data.data.refreshToken
                                    );
                                    const userDetails =
                                        await fetchUserDetails();
                                    dispatch(setUserDetails(userDetails.data));
                                    navigate(
                                        getRoleHomePath(userDetails.data?.role)
                                    );
                                }
                            } catch (error) {
                                AxiosToastError(error);
                            } finally {
                                setFacebookLoading(false);
                            }
                        }}
                        onFail={(error) => {
                            console.error('Facebook Login Error', error);
                            toast.error('Đăng nhập Facebook thất bại.');
                            setFacebookLoading(false);
                        }}
                        render={({ onClick }) => (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2 h-12 border-2 border-muted-foreground/30 rounded-lg cursor-pointer bg-background/50 hover:bg-muted/50 hover:border-[#C96048] transition-all active:scale-95 font-semibold"
                                onClick={() => {
                                    if (!import.meta.env.VITE_FACEBOOK_APP_ID) {
                                        toast.error(
                                            'Vui lòng cấu hình VITE_FACEBOOK_APP_ID trong .env'
                                        );
                                        return;
                                    }
                                    setFacebookLoading(true);
                                    onClick();
                                }}
                                disabled={facebookLoading}
                            >
                                {facebookLoading ? (
                                    <Loading />
                                ) : (
                                    <>
                                        <FaFacebookSquare className="text-blue-600 text-lg" />
                                        <span>Facebook</span>
                                    </>
                                )}
                            </Button>
                        )}
                    />
                </div>
            </div>

            {/* Register Link */}
            <div className="text-center text-sm mt-2">
                <span className="text-muted-foreground">
                    Chưa có tài khoản?{' '}
                </span>
                <Link
                    to={'/register'}
                    className="hover:opacity-80 cursor-pointer transition-opacity font-semibold hover:underline"
                    style={{ color: '#C96048' }}
                >
                    Đăng ký ngay
                </Link>
            </div>
        </form>
    );
}
