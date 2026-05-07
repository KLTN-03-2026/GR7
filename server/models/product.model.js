import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    image: {
        type: Array,
        default: [],
    },
    category: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'category',
        }
    ],
    subCategory: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'subCategory',
        }
    ],
    price: {
        type: Number,
        default: 0,
    },
    discount: {
        type: Number,
        default: 0,
    },
    description: {
        type: String,
        default: "",
    },
    more_details: {
        type: Object,
        default: {}
    },
    publish: {
        type: Boolean,
        default: true,
    },
    
    stock: {
        type: Number,
        default: null, // null = không giới hạn
    },
    status: {
        type: String,
        enum: ['available', 'out_of_stock', 'seasonal'],
        default: 'available'
    },
    // Thời gian chuẩn bị (phút)
    preparationTime: {
        type: Number,
        default: 15,
        min: 0
    },
    // Món nổi bật/đặc biệt
    isFeatured: {
        type: Boolean,
        default: false
    },
    // Tùy chọn món ăn (Size, Topping, etc.)
    options: [
        {
            name: { type: String, required: true }, // e.g., "Size", "Đường", "Đá"
            type: { type: String, enum: ['radio', 'checkbox'], default: 'radio' }, // radio = chọn 1, checkbox = chọn nhiều
            choices: [
                {
                    name: { type: String, required: true }, // e.g., "M", "L", "50%"
                    priceModifier: { type: Number, default: 0 }, // Giá cộng thêm
                    isDefault: { type: Boolean, default: false }
                }
            ]
        }
    ],
    // Soft Delete (PB08, PB09)
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

// Middleware: Tự động cập nhật status dựa trên stock
productSchema.pre('save', function(next) {
    // Chỉ tự động cập nhật nếu không phải 'seasonal'
    if (this.status !== 'seasonal') {
        if (this.stock === null) {
            this.status = 'available'; // Unlimited
        } else if (this.stock === 0) {
            this.status = 'out_of_stock';
        } else if (this.stock > 0) {
            this.status = 'available';
        }
    }
    next();
});

// Tạo text index cho name & description với trọng số (weights)
productSchema.index(
    { name: "text", description: "text" },
    { weights: { name: 10, description: 5 } } // name ưu tiên cao hơn
);

// Index cho soft delete
productSchema.index({ isDeleted: 1 });
productSchema.index({ deletedAt: 1 });

const ProductModel = mongoose.model("product", productSchema)

export default ProductModel
