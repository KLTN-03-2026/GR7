import mongoose from "mongoose";

const loyaltyTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    orderId: {
        type: mongoose.Schema.ObjectId,
        ref: 'tableOrder',
        required: true
    },
    pointsChange: {
        type: Number,
        required: true,
        // Positive for earning, negative for spending
    },
    type: {
        type: String,
        enum: ['earn', 'redeem', 'refund'],
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
        // Points balance after this transaction
    },
    description: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

// Index for faster history lookup
loyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });

const LoyaltyTransactionModel = mongoose.model("loyaltyTransaction", loyaltyTransactionSchema);

export default LoyaltyTransactionModel;
