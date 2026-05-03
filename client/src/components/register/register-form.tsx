import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '@/store/userSlice';
import fetchUserDetails from '@/utils/fetchUserDetails';
import { Eye, EyeOff } from 'lucide-react';
import { FaFacebookSquare } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import toast from 'react-hot-toast';
import AxiosToastError from '@/utils/AxiosToastError';
import Loading from '../Loading';
import { useGoogleLogin } from '@react-oauth/google';
import FacebookLogin from '@greatsumini/react-facebook-login';
import { FaGoogle } from 'react-icons/fa';
import BorderGlow from '../animations/BorderGlow';

export function RegisterForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'form'>) {
    const [data, setData] = useState({
        name: '',
        email: '',
        mobile: '',
        password: '',
        confirmPassword: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [facebookLoading, setFacebookLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setData((prev) => ({ ...prev, [name]: value }));
    };

    const validateEmail = (email: string) => {
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

    const validateMobile = (mobile: string) => {
        // Vietnamese phone number: 10 digits, starts with 0
        const mobileRegex = /^0[1-9][0-9]{8}$/;
        return mobile && mobileRegex.test(mobile);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!data.name && !data.email && !data.mobile && !data.password) {
            toast.error('Vui lòng nhập đầy đủ thông tin.');
            return;
        }
        if (!data.email) {
            toast.error('Vui lòng nhập đầy đủ thông tin.');
            return;
        } else if (!validateEmail(data.email)) {
            toast.error('Vui lòng nhập địa chỉ email hợp lệ');
            return;
        }
        if (!data.mobile) {
            toast.error('Vui lòng nhập đầy đủ thông tin.');
            return;
        } else if (!validateMobile(data.mobile)) {
            toast.error('Số điện thoại không hợp lệ');
            return;
        }
        if (!data.password) {
            toast.error('Vui lòng nhập đầy đủ thông tin.');
            return;
        } else if (data.password.length < 6) {
            toast.error('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }
        if (!data.confirmPassword) {
            toast.error('Vui lòng nhập đầy đủ thông tin.');
            return;
        } else if (data.password !== data.confirmPassword) {
            toast.error('Mật khẩu và mật khẩu xác nhận phải giống nhau');
            return;
        }

        try {
            setLoading(true);
            const response = await Axios({ ...SummaryApi.register, data });

            if (response.data.error) {
                toast.error(response.data.message);
            }
            if (response.data.success) {
                toast.success(response.data.message);
                navigate('/registration-success', {
                    state: { email: data.email },
                    replace: true,
                });
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
                    toast.success('Đăng ký và đăng nhập Google thành công!');
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
                    navigate('/');
                }
            } catch (error) {
                AxiosToastError(error);
            } finally {
                setGoogleLoading(false);
            }
        },
        onError: () => {
            toast.error('Đăng ký Google thất bại. Vui lòng thử lại.');
            setGoogleLoading(false);
        },
        flow: 'implicit',
    });

    return (
        <form
            className={cn(
                'flex flex-col gap-5 font-semibold text-foreground',
                className
            )}
            {...props}
            onSubmit={handleSubmit}
        >
            {/* Form Fields */}
            <div className="grid gap-4">
                {/* Name Field */}
                <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-semibold">
                        Tên người dùng
                    </Label>
                    <Input
                        id="name"
                        type="text"
                        name="name"
                        autoFocus
                        placeholder="Nhập tên của bạn"
                        onChange={handleChange}
                        value={data.name}
                        className="h-12 border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors"
                    />
                </div>

                {/* Email Field */}
                <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-semibold">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        name="email"
                        placeholder="your@email.com"
                        onChange={handleChange}
                        value={data.email}
                        className="h-12 border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors"
                    />
                </div>

                {/* Mobile Field */}
                <div className="grid gap-2">
                    <Label htmlFor="mobile" className="text-sm font-semibold">
                        Số điện thoại
                    </Label>
                    <Input
                        id="mobile"
                        type="tel"
                        name="mobile"
                        placeholder="Nhập số điện thoại của bạn"
                        onChange={handleChange}
                        value={data.mobile}
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

                {/* Confirm Password Field */}
                <div className="grid gap-2">
                    <Label
                        htmlFor="confirmPassword"
                        className="text-sm font-semibold"
                    >
                        Xác nhận mật khẩu
                    </Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            placeholder="Xác nhận mật khẩu của bạn"
                            onChange={handleChange}
                            value={data.confirmPassword}
                            className="h-12 pr-10 border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors"
                        />
                        <button
                            type="button"
                            className="absolute right-0 top-0 h-full px-3 py-0 cursor-pointer"
                            onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                            }
                        >
                            {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            ) : (
                                <Eye className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Register Button with BorderGlow */}
                <BorderGlow
                    borderColor="#C96048"
                    glowColor="#d97a66"
                    animated={true}
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
                        {loading ? <Loading /> : 'Đăng ký'}
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
                                    data: { accessToken: response.accessToken },
                                });

                                if (loginRes.data.error) {
                                    toast.error(loginRes.data.message);
                                    return;
                                }

                                if (loginRes.data.success) {
                                    toast.success(
                                        'Đăng ký và đăng nhập Facebook thành công!'
                                    );
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
                                    navigate('/');
                                }
                            } catch (error) {
                                AxiosToastError(error);
                            } finally {
                                setFacebookLoading(false);
                            }
                        }}
                        onFail={(error) => {
                            console.error('Facebook Register Error', error);
                            toast.error('Đăng ký Facebook thất bại.');
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

            {/* Login Link */}
            <div className="text-center text-sm mt-2">
                <span className="text-muted-foreground">
                    Bạn đã có tài khoản?{' '}
                </span>
                <Link
                    to={'/login'}
                    className="hover:opacity-80 cursor-pointer transition-opacity font-semibold hover:underline"
                    style={{ color: '#C96048' }}
                >
                    Đăng nhập
                </Link>
            </div>
        </form>
    );
}
