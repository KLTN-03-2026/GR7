import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import toast from 'react-hot-toast';
import AxiosToastError from '@/utils/AxiosToastError';
import Loading from '../Loading';
import { Eye, EyeOff } from 'lucide-react';
import BorderGlow from '../animations/BorderGlow';

export function ResetPasswordForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'form'>) {
    const [data, setData] = useState({
        email: '',
        newPassword: '',
        confirmNewPassword: '',
    });

    const location = useLocation();
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (location?.state?.fromForgotPassword && !location?.state?.email) {
            navigate('/');
            return;
        }

        if (location?.state?.email) {
            setData((prev) => ({
                ...prev,
                email: location.state.email,
            }));
        }
    }, [location, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setData((prev) => {
            return {
                ...prev,
                [name]: value,
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!data.newPassword || !data.confirmNewPassword) {
            toast.error('Vui lòng nhập đầy đủ thông tin');
            return;
        }

        if (data.newPassword !== data.confirmNewPassword) {
            toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp');
            return;
        }

        if (data.newPassword.length < 6) {
            toast.error('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        if (
            location?.state?.fromProfile &&
            data.newPassword === location.state.currentPassword
        ) {
            toast.error('Mật khẩu mới phải khác mật khẩu hiện tại');
            return;
        }

        try {
            setLoading(true);

            const isChangePasswordFlow = location?.state?.fromProfile;
            const requestData = isChangePasswordFlow
                ? {
                      userId: location.state.userId,
                      newPassword: data.newPassword,
                      confirmNewPassword: data.confirmNewPassword,
                  }
                : {
                      email: data.email || '',
                      newPassword: data.newPassword,
                      confirmNewPassword: data.confirmNewPassword,
                  };

            const response = await Axios({
                ...(isChangePasswordFlow
                    ? SummaryApi.change_password
                    : SummaryApi.reset_password),
                data: requestData,
            });

            if (response.data.error) {
                toast.error(response.data.message);
                return;
            }

            if (response.data.success) {
                toast.success(response.data.message);

                if (location?.state?.fromProfile) {
                    navigate('/dashboard/profile');
                } else {
                    navigate('/login');
                }

                setData({
                    email: '',
                    newPassword: '',
                    confirmNewPassword: '',
                });
            }
        } catch (error) {
            AxiosToastError(error);
        } finally {
            setLoading(false);
        }
    };

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
                {/* New Password Field */}
                <div className="grid gap-2">
                    <Label htmlFor="newPassword" className="text-sm font-semibold">Mật khẩu mới</Label>
                    <div className="relative">
                        <Input
                            id="newPassword"
                            type={showNewPassword ? 'text' : 'password'}
                            name="newPassword"
                            autoFocus
                            placeholder="Nhập mật khẩu của bạn"
                            onChange={handleChange}
                            value={data.newPassword}
                            className="h-12 pr-10 border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors"
                        />
                        <button
                            type="button"
                            className="absolute right-0 top-0 h-full px-3 py-0 cursor-pointer"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                            {showNewPassword ? (
                                <EyeOff className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            ) : (
                                <Eye className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Confirm New Password Field */}
                <div className="grid gap-2">
                    <Label htmlFor="confirmNewPassword" className="text-sm font-semibold">
                        Xác nhận mật khẩu mới
                    </Label>
                    <div className="relative">
                        <Input
                            id="confirmNewPassword"
                            type={showConfirmNewPassword ? 'text' : 'password'}
                            name="confirmNewPassword"
                            placeholder="Xác nhận mật khẩu của bạn"
                            onChange={handleChange}
                            value={data.confirmNewPassword}
                            className="h-12 pr-10 border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors"
                        />
                        <button
                            type="button"
                            className="absolute right-0 top-0 h-full px-3 py-0 cursor-pointer"
                            onClick={() =>
                                setShowConfirmNewPassword(
                                    !showConfirmNewPassword
                                )
                            }
                        >
                            {showConfirmNewPassword ? (
                                <EyeOff className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            ) : (
                                <Eye className="h-5 w-5 text-muted-foreground hover:text-orange-500" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Submit Button with BorderGlow */}
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
                            background: 'linear-gradient(135deg, #C96048 0%, #d97a66 100%)',
                        }}
                    >
                        {loading ? <Loading /> : 'Xác nhận'}
                    </Button>
                </BorderGlow>
            </div>

            {/* Back to Login Link */}
            <div className="text-center text-sm mt-2">
                <span className="text-muted-foreground">Nhớ mật khẩu? </span>
                <Link
                    to={'/login'}
                    className="hover:opacity-80 cursor-pointer transition-opacity font-semibold hover:underline"
                    style={{ color: '#C96048' }}
                >
                    Quay lại đăng nhập
                </Link>
            </div>
        </form>
    );
}
