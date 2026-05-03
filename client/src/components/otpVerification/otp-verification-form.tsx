import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import toast from 'react-hot-toast';
import AxiosToastError from '@/utils/AxiosToastError';
import Loading from '../Loading';
import BorderGlow from '../animations/BorderGlow';

export function OtpVerificationForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'form'>) {
    const [data, setData] = useState(['', '', '', '', '', '']);
    const navigate = useNavigate();
    const inputRef = useRef<(HTMLInputElement | null)[]>([]);
    const location = useLocation();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!location?.state?.email) {
            navigate('/forgot-password');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!data.join('')) {
            toast.error('Vui lòng nhập mã OTP');
            return;
        }

        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.forgot_password_otp_verification,
                data: {
                    otp: data.join(''),
                    email: location?.state?.email,
                },
            });

            if (response.data.error) {
                toast.error(response.data.message);
                return;
            }

            if (response.data.success) {
                toast.success(response.data.message);

                setData(['', '', '', '', '', '']);
                navigate('/reset-password', {
                    state: {
                        data: response.data,
                        email: location?.state?.email,
                    },
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
                {/* OTP Input Fields */}
                <div className="grid gap-2">
                    <Label htmlFor="otp-0" className="text-sm font-semibold">Mã OTP</Label>
                    <div className="flex items-center justify-between gap-2">
                        {data.map((element, index) => {
                            return (
                                <Input
                                    key={'otp' + index}
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    id={`otp-${index}`}
                                    ref={(el) => {
                                        inputRef.current[index] = el;
                                    }}
                                    value={data[index]}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        const newData = [...data];
                                        newData[index] = value;
                                        setData(newData);

                                        if (value && index < 5) {
                                            inputRef.current[index + 1]?.focus();
                                        }
                                    }}
                                    maxLength={1}
                                    className="h-14 w-14 text-center text-xl font-bold border-muted-foreground border-2 focus-visible:ring-0 shadow-none rounded-lg bg-background/50 focus-visible:border-[#C96048] transition-colors no-spinner"
                                    style={{
                                        color: '#C96048'
                                    }}
                                />
                            );
                        })}
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
                        {loading ? <Loading /> : 'Xác nhận OTP'}
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
