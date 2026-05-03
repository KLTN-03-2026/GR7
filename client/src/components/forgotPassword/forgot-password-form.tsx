import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import toast from 'react-hot-toast';
import AxiosToastError from '@/utils/AxiosToastError';
import Loading from '../Loading';
import BorderGlow from '../animations/BorderGlow';

export function ForgotPasswordForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'form'>) {
    const [data, setData] = useState({
        email: '',
    });

    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setData((prev) => {
            return {
                ...prev,
                [name]: value,
            };
        });
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

        if (!emailRegex.test(email)) {
            return false;
        }

        const domain = email.split('@')[1];
        const tld = domain.split('.').slice(1).join('.');

        if (!validTLDs.includes(tld)) {
            return false;
        }

        if (
            email.includes('..') ||
            email.startsWith('.') ||
            email.endsWith('.') ||
            email.split('@')[0].endsWith('.')
        ) {
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!data.email) {
            toast.error('Vui lòng nhập email');
            return;
        } else if (!validateEmail(data.email)) {
            toast.error('Vui lòng nhập địa chỉ email hợp lệ');
            return;
        }

        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.forgot_password,
                data: data,
            });

            if (response.data.error) {
                toast.error(response.data.message);
            }

            if (response.data.success) {
                toast.success(response.data.message);
                navigate('/verification-otp', {
                    state: data,
                });

                setData({
                    email: '',
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
                {/* Email Field */}
                <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
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
                        {loading ? <Loading /> : 'Gửi mã OTP'}
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
