import React from 'react';
import { Link } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GlareHover from '@/components/GlareHover';
import Divider from '@/components/Divider';

const BookingCancelPage = () => {
    return (
        <section className="container mx-auto py-12 px-4">
            <Card className="max-w-2xl mx-auto border-orange-500 border-2 py-6">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl text-orange-500 font-bold">
                        ⚠️ Thanh toán bị hủy
                    </CardTitle>
                    <CardDescription className="text-lg mt-4">
                        Quá trình thanh toán tiền cọc của bạn đã bị hủy hoặc không thành công.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="bg-foreground/20 p-6 rounded-lg space-y-3 text-center">
                        <p className="text-foreground">
                            Đừng lo lắng! Yêu cầu đặt bàn của bạn chưa được hoàn tất nếu chưa có thanh toán tiền cọc (đối với yêu cầu cọc).
                            <br />
                            Bạn có thể thử thanh toán lại hoặc liên hệ với nhà hàng để được hỗ trợ.
                        </p>
                    </div>

                    <div className="space-y-3 text-sm">
                        <p className="flex items-start gap-2">
                            <span className="text-orange-500 font-bold">!</span>
                            <span>
                                Thanh toán tiền cọc là bắt buộc đối với các đơn đặt bàn từ 5 người trở lên hoặc có món đặt trước.
                            </span>
                        </p>
                        <p className="flex items-start gap-2">
                            <span className="text-orange-500 font-bold">!</span>
                            <span>
                                Nếu bạn gặp lỗi kỹ thuật trong quá trình thanh toán, hãy thử lại bằng trình duyệt khác hoặc thẻ khác.
                            </span>
                        </p>
                    </div>

                    <Divider />

                    <div className="flex gap-4 justify-center pt-4">
                        <Link to="/booking">
                            <Button variant="outline" className="h-11 px-6">
                                Thử đặt bàn lại
                            </Button>
                        </Link>

                        <GlareHover
                            background="transparent"
                            glareOpacity={0.3}
                            glareAngle={-30}
                            glareSize={300}
                            transitionDuration={800}
                            playOnce={false}
                        >
                            <Link to="/">
                                <Button className="bg-foreground h-11 px-8">
                                    Về trang chủ
                                </Button>
                            </Link>
                        </GlareHover>
                    </div>
                </CardContent>
            </Card>
        </section>
    );
};

export default BookingCancelPage;
