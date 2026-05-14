import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: [true, "Vui lòng nhập tên khách hàng"],
        trim: true
    },
    phone: {
        type: String,
        required: [true, "Vui lòng nhập số điện thoại"],
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    tableId: {
        type: mongoose.Schema.ObjectId,
        ref: 'table',
        default: null  // Nullable - assigned by staff when customer arrives or during booking
    },
    numberOfGuests: {
        type: Number,
        required: [true, "Vui lòng nhập số người"],
        min: [1, "Số người phải lớn hơn 0"]
    },
    bookingDate: {
        type: Date,
        required: [true, "Vui lòng chọn ngày đặt bàn"]
    },
    bookingTime: {
        type: String,
        required: [true, "Vui lòng chọn giờ đặt bàn"]
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    specialRequests: {
        type: String,
        default: "",
        trim: true
    },
    cancelledBy: {
        type: String,
        enum: ['customer', 'admin', 'system'],
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'user',
        default: null
    },
    createdBy: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
    },
    // Pre-order (Đặt món trước) - Optional for bookings
    preOrderId: {
        type: mongoose.Schema.ObjectId,
        ref: 'tableOrder',
        default: null
    },
    hasPreOrder: {
        type: Boolean,
        default: false
    },
    preOrderTotal: {
        type: Number,
        default: 0,
        min: 0
    },
    // Embedded pre-order items (stored at booking time; converted to tableOrder when guest arrives)
    preOrderItems: [{
        productId: { type: mongoose.Schema.ObjectId, ref: 'product' },
        name:      { type: String, required: true },
        price:     { type: Number, required: true, min: 0 },
        quantity:  { type: Number, required: true, min: 1, default: 1 },
        image:     { type: String, default: '' }
    }],
    // Deposit (Đặt cọc) - Required for groups ≥ 5 people (PB13)
    depositRequired: {
        type: Boolean,
        default: false
    },
    depositAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    depositStatus: {
        type: String,
        enum: ['not_required', 'pending', 'paid', 'refunded'],
        default: 'not_required'
    },
    depositPaid: { // Backward compatibility for Admin UI
        type: Boolean,
        default: false
    },
    depositPaidAt: {
        type: Date,
        default: null
    },
    // Stripe payment for deposit
    stripeDepositSessionId: {
        type: String,
        default: null
    },
    stripeDepositPaymentIntentId: {
        type: String,
        default: null
    },
    paymentIntentId: { // Alias for stripeDepositPaymentIntentId
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
bookingSchema.index({ bookingDate: 1, bookingTime: 1 });
bookingSchema.index({ tableId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ userId: 1 });   // thêm index cho user query
bookingSchema.index({ phone: 1 });
bookingSchema.index({ email: 1 });
bookingSchema.index({ depositStatus: 1 }); // index cho deposit query

// Middleware: Auto-set depositRequired
// Điều kiện: số khách >= 5 HOẶC khách có đặt món trước (hasPreOrder)
// → tránh tình trạng "bom hàng" khi khách pre-order món đắt tiền rồi không đến
bookingSchema.pre('save', function(next) {
    const hasLargeParty  = this.numberOfGuests >= 5;
    const hasPreOrdered  = this.hasPreOrder === true && this.preOrderTotal > 0;

    if (hasLargeParty || hasPreOrdered) {
        this.depositRequired = true;
        if (this.depositStatus === 'not_required') {
            this.depositStatus = 'pending';
        }
    } else {
        this.depositRequired = false;
        this.depositStatus   = 'not_required';
        this.depositAmount   = 0;
    }
    next();
});

// Middleware: Validate booking date/time constraints
bookingSchema.pre('save', function(next) {
    const now = new Date();
    const bookingDateTime = new Date(this.bookingDate);
    
    // Parse bookingTime (format: "HH:MM" or "HH:MM:SS")
    if (this.bookingTime) {
        const [hours, minutes] = this.bookingTime.split(':').map(Number);
        bookingDateTime.setHours(hours, minutes, 0, 0);
    }
    
    // Validation 1: Booking must be in the future (at least 1 hour from now)
    const minBookingTime = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
    if (bookingDateTime < minBookingTime) {
        return next(new Error('Thời gian đặt bàn phải ít nhất 1 giờ kể từ bây giờ'));
    }
    
    // Validation 2: Booking cannot be more than 12 hours in advance
    const maxBookingTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // +12 hours
    if (bookingDateTime > maxBookingTime) {
        return next(new Error('Chỉ có thể đặt bàn trước tối đa 12 giờ'));
    }
    
    next();
});

const BookingModel = mongoose.model("booking", bookingSchema);

export default BookingModel;
