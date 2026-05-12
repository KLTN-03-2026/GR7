import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import SummaryApi from '../common/SummaryApi';
import Axios from '../utils/Axios';
import AxiosToastError from '../utils/AxiosToastError';
import successAlert from '../utils/successAlert';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@radix-ui/react-label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import GlareHover from '@/components/GlareHover';
import Loading from '@/components/Loading';
import Divider from '@/components/Divider';

const BookingPage = () => {
    const [loading, setLoading] = useState(false);
    const [availableTables, setAvailableTables] = useState([]);
    const [loadingTables, setLoadingTables] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [bookingId, setBookingId] = useState('');

    // Pre-order state
    const [showMenuPopup, setShowMenuPopup]         = useState(false);
    const [preOrderItems, setPreOrderItems]         = useState([]);
    const [menuProducts, setMenuProducts]           = useState([]);
    const [menuLoading, setMenuLoading]             = useState(false);
    const [menuSearch, setMenuSearch]               = useState('');
    const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
    const [categories, setCategories]               = useState([]);

    const user = useSelector((state) => state.user);

    const [formData, setFormData] = useState({
        customerName: '',
        phone: '',
        email: '',
        numberOfGuests: '',
        bookingDate: '',
        bookingTime: '',
        tableId: '',
        specialRequests: '',
    });

    useEffect(() => {
        if (user?._id) {
            setFormData((prev) => ({
                ...prev,
                customerName: user.name || '',
                email: user.email || '',
                phone: user.mobile || '',
            }));
        }
    }, [user]);

    // Time slots (18:00 - 22:00, 30 min intervals)
    const timeSlots = [
        '18:00',
        '18:30',
        '19:00',
        '19:30',
        '20:00',
        '20:30',
        '21:00',
        '21:30',
        '22:00',
    ];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSelectChange = (name, value) => {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Fetch available tables
    const fetchAvailableTables = useCallback(async () => {
        if (
            !formData.bookingDate ||
            !formData.bookingTime ||
            !formData.numberOfGuests
        ) {
            setAvailableTables([]);
            return;
        }

        try {
            setLoadingTables(true);
            const response = await Axios({
                ...SummaryApi.get_available_tables_for_booking,
                data: {
                    bookingDate: formData.bookingDate,
                    bookingTime: formData.bookingTime,
                    numberOfGuests: parseInt(formData.numberOfGuests),
                },
            });

            if (response.data.success) {
                setAvailableTables(response.data.data);
                if (
                    formData.tableId &&
                    !response.data.data.find((t) => t._id === formData.tableId)
                ) {
                    setFormData((prev) => ({ ...prev, tableId: '' }));
                }
            }
        } catch (error) {
            AxiosToastError(error);
            setAvailableTables([]);
        } finally {
            setLoadingTables(false);
        }
    }, [
        formData.bookingDate,
        formData.bookingTime,
        formData.numberOfGuests,
        formData.tableId,
    ]);

    useEffect(() => {
        fetchAvailableTables();
    }, [fetchAvailableTables]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (
            !formData.customerName ||
            !formData.phone ||
            !formData.numberOfGuests ||
            !formData.bookingDate ||
            !formData.bookingTime ||
            !formData.tableId
        ) {
            AxiosToastError({
                response: {
                    data: {
                        message: 'Vui lòng điền đầy đủ thông tin bắt buộc',
                    },
                },
            });
            return;
        }

        // ── Deposit check (new logic) ────────────────────────────────────
        // Điều kiện: số khách >= 5 HOẶC có Pre-order → yêu cầu đặt cọc
        const hasLargeParty    = guests >= 5;
        const hasPreOrderItems = preOrderItems.length > 0;
        const guestDeposit     = hasLargeParty ? guests * 50000 : 0;
        const preOrderDeposit  = preOrderTotal; // 100% giá trị món đặt trước
        const totalDeposit     = guestDeposit + preOrderDeposit;

        if (hasLargeParty || hasPreOrderItems) {
            const lines = [];
            if (hasLargeParty) {
                lines.push(`• Phí giữ bàn: ${guestDeposit.toLocaleString('vi-VN')}đ (${guests} người × 50.000đ)`);
            }
            if (hasPreOrderItems) {
                lines.push(`• Cọc món đặt trước: ${preOrderDeposit.toLocaleString('vi-VN')}đ (100% giá trị món)`);
            }
            const confirmDeposit = window.confirm(
                `Đặt bàn của bạn yêu cầu đặt cọc ${totalDeposit.toLocaleString('vi-VN')}đ:\n\n` +
                lines.join('\n') +
                `\n\nBạn có muốn tiếp tục thanh toán không?`
            );
            if (!confirmDeposit) return;
        }

        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.create_booking,
                data: {
                    ...formData,
                    numberOfGuests: guests,
                    createdBy: 'customer',
                    preOrderItems,
                },
            });

            if (response.data.success) {
                const booking = response.data.data;

                // Handle deposit if required
                if (booking.depositAmount > 0) {
                    try {
                        const paymentResponse = await Axios({
                            ...SummaryApi.create_booking_payment_session,
                            data: {
                                bookingId: booking._id,
                            },
                        });

                        if (paymentResponse.data && paymentResponse.data.url) {
                            window.location.href = paymentResponse.data.url;
                            return; // Stop here, redirecting
                        }
                    } catch (paymentError) {
                        console.error(
                            'Payment session creation failed:',
                            paymentError
                        );
                        AxiosToastError(paymentError);
                        // Even if payment fails, booking is created but pending/unpaid.
                        // We can show success but mention payment is pending?
                        // Or just show normal success and let them pay later (if we had that feature).
                        // For now, fall through to normal success.
                    }
                }

                successAlert(response.data.message);
                setBookingId(booking._id);
                setBookingSuccess(true);

                setFormData({
                    customerName: '',
                    phone: '',
                    email: '',
                    numberOfGuests: '',
                    bookingDate: '',
                    bookingTime: '',
                    tableId: '',
                    specialRequests: '',
                });
                setAvailableTables([]);
                setPreOrderItems([]);
            }
        } catch (error) {
            AxiosToastError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewBooking = () => {
        setBookingSuccess(false);
        setBookingId('');
    };

    // ── Pre-order helpers ──────────────────────────────────────────
    const fetchMenuProducts = useCallback(async () => {
        if (menuProducts.length > 0) return;
        try {
            setMenuLoading(true);
            const [prodRes, catRes] = await Promise.allSettled([
                Axios({ ...SummaryApi.get_product, data: { page: 1, limit: 100 } }),
                Axios({ ...SummaryApi.get_category }),
            ]);
            if (prodRes.status === 'fulfilled' && prodRes.value.data?.success) {
                const raw = prodRes.value.data.data;
                setMenuProducts(Array.isArray(raw) ? raw : (raw?.data || []));
            }
            if (catRes.status === 'fulfilled' && catRes.value.data?.success) {
                setCategories(catRes.value.data.data || []);
            }
        } catch (err) {
            console.error('Pre-order menu load error:', err);
        } finally {
            setMenuLoading(false);
        }
    }, [menuProducts.length]);

    const handleOpenMenuPopup = () => { setShowMenuPopup(true); fetchMenuProducts(); };

    const getPreOrderQty = (productId) =>
        preOrderItems.find((i) => i.productId === productId)?.quantity || 0;

    const handleAddToPreOrder = (product) => {
        const price = (product.discountPrice > 0 && product.discountPrice < product.price)
            ? product.discountPrice : product.price;
        setPreOrderItems((prev) => {
            const hit = prev.find((i) => i.productId === product._id);
            if (hit) return prev.map((i) => i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { productId: product._id, name: product.name, price, quantity: 1, image: product.image?.[0] || '' }];
        });
    };

    const handleUpdatePreOrderQty = (productId, delta) => {
        setPreOrderItems((prev) => prev.reduce((acc, item) => {
            if (item.productId !== productId) return [...acc, item];
            const newQty = item.quantity + delta;
            return newQty <= 0 ? acc : [...acc, { ...item, quantity: newQty }];
        }, []));
    };

    const handleClearPreOrder = () => setPreOrderItems([]);

    const preOrderTotal     = preOrderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const preOrderItemCount = preOrderItems.reduce((s, i) => s + i.quantity, 0);

    const filteredMenuProducts = menuProducts.filter((p) => {
        const matchSearch = !menuSearch || p.name?.toLowerCase().includes(menuSearch.toLowerCase());
        // category có thể là object {_id, name} hoặc string ObjectId → cần toString()
        const productCatId = (p.category?._id ?? p.category)?.toString() ?? '';
        const matchCat = menuCategoryFilter === 'all' || productCatId === menuCategoryFilter;
        return matchSearch && matchCat;
    });

    const today = new Date().toISOString().split('T')[0];

    if (bookingSuccess) {
        return (
            <section className="container mx-auto py-8 px-4">
                <Card className="max-w-2xl mx-auto border-green-600 border-2 py-6">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl text-green-600 font-bold">
                            🎉 Đặt bàn thành công!
                        </CardTitle>
                        <CardDescription className="text-base mt-4">
                            Cảm ơn bạn đã đặt bàn tại nhà hàng của chúng tôi
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="bg-foreground/20 p-6 rounded-lg space-y-3">
                            <div className="text-center">
                                <Label className="text-sm text-foreground">
                                    Mã đặt bàn của bạn
                                </Label>
                                <p className="text-xl font-bold text-green-500 mt-2 break-all">
                                    {bookingId}
                                </p>
                            </div>
                            <Divider />
                            <p className="text-sm text-center text-foreground">
                                Vui lòng lưu lại mã này để tra cứu hoặc hủy đặt
                                bàn
                            </p>
                        </div>

                        <div className="space-y-3 text-sm">
                            <p className="flex items-start gap-2">
                                <span className="text-green-600">✓</span>
                                <span>
                                    Đặt bàn của bạn đang ở trạng thái{' '}
                                    <strong>Chờ xác nhận</strong>
                                </span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-green-600">✓</span>
                                <span>
                                    Chúng tôi sẽ liên hệ với bạn để xác nhận
                                </span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-green-600">✓</span>
                                <span>
                                    Bạn có thể tra cứu đặt bàn bằng số điện
                                    thoại hoặc mã đặt bàn
                                </span>
                            </p>
                        </div>

                        <div className="flex gap-3 justify-center pt-4">
                            <GlareHover
                                background="transparent"
                                glareOpacity={0.3}
                                glareAngle={-30}
                                glareSize={300}
                                transitionDuration={800}
                                playOnce={false}
                            >
                                <Button
                                    onClick={handleNewBooking}
                                    className="bg-foreground"
                                >
                                    Đặt bàn mới
                                </Button>
                            </GlareHover>
                        </div>
                    </CardContent>
                </Card>
            </section>
        );
    }

    return (
        <>
        <section className="container mx-auto py-8 px-4">
            <Card className="max-w-3xl mx-auto border-foreground border-2 py-6">
                <CardHeader>
                    <CardTitle className="text-2xl text-highlight font-bold text-center">
                        Đặt bàn trực tuyến
                    </CardTitle>
                    <CardDescription className="text-center">
                        Vui lòng điền thông tin để đặt bàn tại nhà hàng
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <h3 className="font-semibold text-lg mb-4">
                                Thông tin khách hàng
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customerName">
                                        Họ và tên{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="text"
                                        id="customerName"
                                        name="customerName"
                                        value={formData.customerName}
                                        onChange={handleChange}
                                        className="h-12"
                                        placeholder="Nguyễn Văn A"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">
                                        Số điện thoại{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="h-12"
                                        placeholder="0912345678"
                                        required
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="h-12"
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <Divider />

                        <div>
                            <h3 className="font-semibold text-lg mb-4">
                                Thông tin đặt bàn
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="numberOfGuests">
                                        Số người{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        id="numberOfGuests"
                                        name="numberOfGuests"
                                        min="1"
                                        value={formData.numberOfGuests}
                                        onChange={handleChange}
                                        className="h-12"
                                        placeholder="Số người"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bookingDate">
                                        Ngày đặt{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        id="bookingDate"
                                        name="bookingDate"
                                        min={today}
                                        value={formData.bookingDate}
                                        onChange={handleChange}
                                        className="h-12"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bookingTime">
                                        Giờ đặt{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={formData.bookingTime}
                                        onValueChange={(value) =>
                                            handleSelectChange(
                                                'bookingTime',
                                                value
                                            )
                                        }
                                        required
                                    >
                                        <SelectTrigger className="w-full h-12">
                                            <SelectValue placeholder="Chọn giờ" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {timeSlots.map((time) => (
                                                <SelectItem
                                                    key={time}
                                                    value={time}
                                                >
                                                    {time}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="tableId">
                                        Chọn bàn{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={formData.tableId}
                                        onValueChange={(value) =>
                                            handleSelectChange('tableId', value)
                                        }
                                        disabled={
                                            !formData.bookingDate ||
                                            !formData.bookingTime ||
                                            !formData.numberOfGuests ||
                                            loadingTables
                                        }
                                        required
                                    >
                                        <SelectTrigger className="w-full h-12">
                                            <SelectValue
                                                placeholder={
                                                    loadingTables
                                                        ? 'Đang tải...'
                                                        : !formData.bookingDate ||
                                                          !formData.bookingTime ||
                                                          !formData.numberOfGuests
                                                        ? 'Chọn ngày, giờ và số người trước'
                                                        : availableTables.length ===
                                                          0
                                                        ? 'Không có bàn trống'
                                                        : 'Chọn bàn'
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableTables.map((table) => (
                                                <SelectItem
                                                    key={table._id}
                                                    value={table._id}
                                                >
                                                    Bàn {table.tableNumber} -{' '}
                                                    {table.capacity} người
                                                    {table.location &&
                                                        ` (${table.location})`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {formData.bookingDate &&
                                        formData.bookingTime &&
                                        formData.numberOfGuests &&
                                        availableTables.length === 0 &&
                                        !loadingTables && (
                                            <p className="text-xs text-red-500">
                                                Không có bàn trống cho thời gian
                                                này. Vui lòng chọn thời gian
                                                khác.
                                            </p>
                                        )}
                                </div>
                            </div>
                        </div>

                        <Divider />

                        <div className="space-y-2">
                            <Label htmlFor="specialRequests">
                                Yêu cầu đặc biệt
                            </Label>
                            <Textarea
                                id="specialRequests"
                                name="specialRequests"
                                value={formData.specialRequests}
                                onChange={handleChange}
                                rows={4}
                                className="resize-none"
                                placeholder="Ví dụ: Cần ghế em bé, vị trí gần cửa sổ, ..."
                            />
                        </div>

                        <Divider />

                        {/* ─── Pre-order section ───────────────────────────── */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                🍽️ Chọn món trước
                                <span className="text-sm font-normal text-muted-foreground">(Tùy chọn)</span>
                            </h3>

                            {preOrderItems.length === 0 ? (
                                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-3">
                                    <p className="text-muted-foreground text-sm">
                                        Đặt món trước giúp nhà hàng chuẩn bị tốt hơn cho bữa ăn của bạn
                                    </p>
                                    <Button type="button" variant="outline"
                                        onClick={handleOpenMenuPopup}
                                        className="h-11 px-6 border-foreground/40 hover:bg-accent">
                                        🍽️ Thêm món ăn trước
                                    </Button>
                                </div>
                            ) : (
                                <div className="border border-border rounded-xl overflow-hidden">
                                    <div className="p-3 bg-accent/30 border-b border-border">
                                        <p className="text-sm font-medium">Đã chọn {preOrderItemCount} món</p>
                                    </div>
                                    <div className="divide-y divide-border">
                                        {preOrderItems.map((item) => (
                                            <div key={item.productId} className="flex items-center gap-3 px-3 py-2.5">
                                                {item.image && (
                                                    <img src={item.image} alt={item.name}
                                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{item.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.price.toLocaleString('vi-VN')}đ × {item.quantity}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-semibold flex-shrink-0">
                                                    {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-accent/20 border-t border-border flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Tạm tính món ăn</p>
                                            <p className="font-bold text-highlight">{preOrderTotal.toLocaleString('vi-VN')}đ</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" size="sm"
                                                onClick={handleOpenMenuPopup} className="h-8 text-xs">✏️ Chỉnh sửa</Button>
                                            <Button type="button" variant="ghost" size="sm"
                                                onClick={handleClearPreOrder}
                                                className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">✕ Xóa tất cả</Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Divider />

                        <div className="flex justify-center pt-4">
                            <GlareHover background="transparent" glareOpacity={0.3}
                                glareAngle={-30} glareSize={300} transitionDuration={800} playOnce={false}>
                                <Button type="submit" className="bg-foreground px-12 h-12 text-base" disabled={loading}>
                                    {loading ? <Loading /> : 'Đặt bàn ngay'}
                                </Button>
                            </GlareHover>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </section>

        {/* ─── Pre-order Menu Popup ─────────────────────────────────── */}
        {showMenuPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border">

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                        <div>
                            <h2 className="text-lg font-bold">🍽️ Chọn món trước</h2>
                            <p className="text-xs text-muted-foreground">
                                {preOrderItemCount > 0
                                    ? `Đã chọn ${preOrderItemCount} món · ${preOrderTotal.toLocaleString('vi-VN')}đ`
                                    : 'Chọn món để nhà hàng chuẩn bị trước'}
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setShowMenuPopup(false)}
                            className="rounded-full h-9 w-9">✕</Button>
                    </div>

                    {/* Search + Category filter */}
                    <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
                        <Input placeholder="🔍 Tìm món..."
                            value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)}
                            className="h-10" />
                        {categories.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                <button type="button"
                                    onClick={() => setMenuCategoryFilter('all')}
                                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition ${
                                        menuCategoryFilter === 'all'
                                            ? 'bg-foreground text-background'
                                            : 'bg-accent text-foreground hover:bg-accent/80'
                                    }`}>Tất cả</button>
                                {categories.map((cat) => (
                                    <button type="button" key={cat._id}
                                        onClick={() => setMenuCategoryFilter(cat._id)}
                                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition ${
                                            menuCategoryFilter === cat._id
                                                ? 'bg-foreground text-background'
                                                : 'bg-accent text-foreground hover:bg-accent/80'
                                        }`}>{cat.name}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product grid – scrollable */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {menuLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-highlight" />
                            </div>
                        ) : filteredMenuProducts.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">Không tìm thấy món nào</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {filteredMenuProducts.map((product) => {
                                    const qty = getPreOrderQty(product._id);
                                    const displayPrice = (product.discountPrice > 0 && product.discountPrice < product.price)
                                        ? product.discountPrice : product.price;
                                    return (
                                        <div key={product._id}
                                            className="border border-border rounded-xl overflow-hidden bg-card hover:shadow-md transition">
                                            <div className="aspect-square">
                                                {product.image?.[0]
                                                    ? <img src={product.image[0]} alt={product.name} className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full bg-accent/40 flex items-center justify-center text-3xl">🍽️</div>}
                                            </div>
                                            <div className="p-2.5 space-y-2">
                                                <p className="text-sm font-medium leading-tight line-clamp-2">{product.name}</p>
                                                <p className="text-sm font-bold text-highlight">{displayPrice.toLocaleString('vi-VN')}đ</p>
                                                {qty === 0 ? (
                                                    <Button type="button" size="sm"
                                                        onClick={() => handleAddToPreOrder(product)}
                                                        className="w-full h-8 text-xs bg-foreground hover:bg-foreground/90">+ Thêm</Button>
                                                ) : (
                                                    <div className="flex items-center justify-between gap-1">
                                                        <Button type="button" size="icon" variant="outline"
                                                            onClick={() => handleUpdatePreOrderQty(product._id, -1)}
                                                            className="h-8 w-8 rounded-lg flex-shrink-0">−</Button>
                                                        <span className="font-bold text-sm w-6 text-center">{qty}</span>
                                                        <Button type="button" size="icon" variant="outline"
                                                            onClick={() => handleUpdatePreOrderQty(product._id, +1)}
                                                            className="h-8 w-8 rounded-lg flex-shrink-0">+</Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-4 border-t border-border flex-shrink-0 gap-3">
                        <div>
                            {preOrderItemCount > 0 && (
                                <>
                                    <p className="text-xs text-muted-foreground">{preOrderItemCount} món · tạm tính</p>
                                    <p className="font-bold text-base">{preOrderTotal.toLocaleString('vi-VN')}đ</p>
                                </>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setShowMenuPopup(false)}
                                className="h-10">Hủy</Button>
                            <Button type="button" onClick={() => setShowMenuPopup(false)}
                                className="h-10 bg-foreground px-6">
                                ✓ Xác nhận {preOrderItemCount > 0 ? `(${preOrderItemCount} món)` : ''}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </>);
};

export default BookingPage;
