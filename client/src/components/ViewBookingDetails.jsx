import React from 'react';
import { IoClose } from 'react-icons/io5';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from '@radix-ui/react-label';
import Divider from './Divider';
import GlareHover from './GlareHover';

const ViewBookingDetails = ({ close, data }) => {
    const getStatusText = (status) => {
        const statusMap = {
            pending: 'Chờ xác nhận',
            confirmed: 'Đã xác nhận',
            cancelled: 'Đã hủy',
            completed: 'Hoàn thành',
        };
        return statusMap[status] || status;
    };

    const getStatusColor = (status) => {
        const colorMap = {
            pending: 'text-yellow-600',
            confirmed: 'text-green-600',
            cancelled: 'text-red-600',
            completed: 'text-gray-600',
        };
        return colorMap[status] || 'text-gray-600';
    };

    // const getPaymentStatusText = (status) => {
    //     const statusMap = {
    //         pending: 'Chưa thanh toán',
    //         paid: 'Đã thanh toán',
    //         failed: 'Thất bại',
    //     };
    //     return statusMap[status] || status || 'Chưa thanh toán';
    // };

    return (
        <section
            className="bg-neutral-800 z-50 bg-opacity-60 fixed top-0 left-0 right-0 bottom-0 overflow-auto
        flex items-center justify-center px-2"
        >
            <Card
                className="w-full max-w-2xl border-foreground overflow-hidden overflow-y-auto
            max-h-[calc(100vh-150px)] scrollbarCustom scrollbar-hide"
            >
                {/* Header */}
                <CardHeader className="pt-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-highlight font-bold uppercase">
                            Chi tiết đặt bàn
                        </CardTitle>
                        <Button
                            onClick={close}
                            className="bg-transparent hover:bg-transparent text-foreground
                        hover:text-highlight h-12"
                        >
                            <IoClose />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="py-4 space-y-4 text-sm">
                    {/* Booking Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">
                                Mã đặt bàn
                            </Label>
                            <p className="font-medium">{data._id}</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">
                                Trạng thái
                            </Label>
                            <p
                                className={`font-bold ${getStatusColor(
                                    data.status
                                )}`}
                            >
                                {getStatusText(data.status)}
                            </p>
                        </div>
                    </div>

                    <Divider />

                    {/* Customer Info */}
                    <div>
                        <h3 className="font-semibold text-base mb-3">
                            Thông tin khách hàng
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Tên khách hàng
                                </Label>
                                <p className="font-medium">
                                    {data.customerName}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Số điện thoại
                                </Label>
                                <p className="font-medium">{data.phone}</p>
                            </div>
                            {data.email && (
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-muted-foreground">
                                        Email
                                    </Label>
                                    <p className="font-medium">{data.email}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Divider />

                    {/* Booking Details */}
                    <div>
                        <h3 className="font-semibold text-base mb-3">
                            Thông tin đặt bàn
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Số bàn
                                </Label>
                                <p className="font-medium">
                                    {data.tableId?.tableNumber || 'N/A'}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Số người
                                </Label>
                                <p className="font-medium">
                                    {data.numberOfGuests} người
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Ngày đặt
                                </Label>
                                <p className="font-medium">
                                    {format(
                                        new Date(data.bookingDate),
                                        'dd/MM/yyyy'
                                    )}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Giờ đặt
                                </Label>
                                <p className="font-medium">
                                    {data.bookingTime}
                                </p>
                            </div>
                            {data.tableId?.location && (
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-muted-foreground">
                                        Vị trí bàn
                                    </Label>
                                    <p className="font-medium">
                                        {data.tableId.location}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {data.hasPreOrder &&
                        data.preOrderItems &&
                        data.preOrderItems.length > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                                        🍽️ Danh sách món đặt trước
                                    </h3>
                                    <div className="space-y-3 bg-accent/20 p-4 rounded-lg">
                                        <div className="space-y-2">
                                            {data.preOrderItems.map(
                                                (item, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex justify-between items-start text-sm"
                                                    >
                                                        <div className="flex gap-3">
                                                            {item.image && (
                                                                <img
                                                                    src={
                                                                        item.image
                                                                    }
                                                                    alt={
                                                                        item.name
                                                                    }
                                                                    className="w-10 h-10 rounded object-cover"
                                                                />
                                                            )}
                                                            <div>
                                                                <p className="font-medium">
                                                                    {item.name}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {item.price?.toLocaleString(
                                                                        'vi-VN'
                                                                    )}
                                                                    đ x{' '}
                                                                    {
                                                                        item.quantity
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="font-medium">
                                                            {(
                                                                item.price *
                                                                item.quantity
                                                            ).toLocaleString(
                                                                'vi-VN'
                                                            )}
                                                            đ
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-foreground/20 mt-2">
                                            <span className="font-bold">
                                                Tổng tiền món:
                                            </span>
                                            <span className="font-bold text-highlight text-lg">
                                                {data.preOrderTotal?.toLocaleString(
                                                    'vi-VN'
                                                )}
                                                đ
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-xs mt-1">
                                            <span className="text-muted-foreground">
                                                Trạng thái:
                                            </span>
                                            <span
                                                className={
                                                    data.depositPaid
                                                        ? 'text-green-600 font-medium'
                                                        : 'text-yellow-600 font-medium'
                                                }
                                            >
                                                {data.depositPaid
                                                    ? 'Đã cọc (Bao gồm tiền món)'
                                                    : 'Chờ thanh toán cọc'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                    {data.specialRequests && (
                        <>
                            <Divider />
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Yêu cầu đặc biệt
                                </Label>
                                <p className="font-medium whitespace-pre-wrap">
                                    {data.specialRequests}
                                </p>
                            </div>
                        </>
                    )}

                    <Divider />

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        <div className="space-y-1">
                            <Label>Ngày tạo</Label>
                            <p>
                                {format(
                                    new Date(data.createdAt),
                                    'dd/MM/yyyy HH:mm'
                                )}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <Label>Cập nhật lần cuối</Label>
                            <p>
                                {format(
                                    new Date(data.updatedAt),
                                    'dd/MM/yyyy HH:mm'
                                )}
                            </p>
                        </div>
                    </div>

                    <Divider />

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <GlareHover
                            background="transparent"
                            glareOpacity={0.3}
                            glareAngle={-30}
                            glareSize={300}
                            transitionDuration={800}
                            playOnce={false}
                        >
                            <Button
                                type="button"
                                onClick={close}
                                className="bg-foreground"
                            >
                                Đóng
                            </Button>
                        </GlareHover>
                    </div>
                </CardContent>
            </Card>
        </section>
    );
};

export default ViewBookingDetails;
