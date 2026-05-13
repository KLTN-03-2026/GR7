import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSmartMenu, getFullMenu, searchMenu } from "../services/menu.service.js";
import TableOrderModel from "../models/tableOrder.model.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL_FALLBACK_CHAIN = [
    "gemini-2.5-flash-lite",   // Nhanh nhất, tiết kiệm quota
    "gemini-2.5-flash",        // Cân bằng tốc độ & chất lượng
    "gemini-2.5-pro",          // Fallback mạnh nhất
];

const BASE_SYSTEM_PROMPT = `Bạn là trợ lý AI của EatEase Restaurant — một nhà hàng hiện đại chuyên phục vụ các món ăn đa dạng với hệ thống đặt bàn và gọi món trực tuyến.

🎯 NHIỆM VỤ CỦA BẠN:
- Tư vấn món ăn phù hợp dựa trên sở thích khách hàng
- Giải đáp thắc mắc về thực đơn, món ăn, giá cả
- Hỗ trợ khách hàng về quy trình đặt bàn trực tuyến
- Hướng dẫn gọi món tại bàn qua QR code
- Thông tin về chính sách hủy đặt bàn, thanh toán (tiền mặt, online qua Stripe)
- Giới thiệu các voucher/mã giảm giá hiện có
- Hỗ trợ theo dõi đơn hàng và trạng thái món ăn
- Thông tin về giờ mở cửa, địa chỉ nhà hàng

✨ PHONG CÁCH TRẢ LỜI:
- Trả lời bằng tiếng Việt, thân thiện, nhiệt tình như một người bạn
- Sử dụng emoji phù hợp để tạo cảm giác gần gũi (🍜 🍕 🥗 ✨ 😊)
- Trả lời ngắn gọn, súc tích, dễ hiểu
- Khi giới thiệu món ăn, hãy mô tả hấp dẫn và đưa ra lý do nên chọn
- Nếu có nhiều lựa chọn, gợi ý 2-3 món phù hợp nhất

⚠️ NGUYÊN TẮC QUAN TRỌNG:
- CHỈ giới thiệu món ăn có trong danh sách menu được cung cấp
- KHÔNG bịa đặt tên món, giá cả hay thông tin không có trong menu
- Nếu không tìm thấy món phù hợp, hãy gợi ý món tương tự hoặc hỏi thêm sở thích
- Khi khách hỏi về giá, luôn đề cập cả giá gốc và giá sau giảm (nếu có)
- Khi cần hỗ trợ nâng cao, gợi ý chat trực tiếp với nhân viên

📋 CÁCH TRẢ LỜI VỀ MÓN ĂN:
- Gọi tên món rõ ràng
- Đề cập giá (và giá sau giảm nếu có discount)
- Mô tả ngắn gọn đặc điểm nổi bật
- Thời gian chuẩn bị (nếu khách hỏi về món nhanh)
- Gợi ý kết hợp với món khác nếu phù hợp`;

// ─── Local FAQ — trả lời ngay không tốn quota ──────────────────────────────
const FAQ = [
    {
        keywords: ["đặt bàn", "booking", "reserve", "giữ chỗ", "book bàn"],
        answer: "Cách đặt bàn tại EatEase:\n1. 📱 Vào trang Đặt bàn trên website\n2. 📅 Chọn ngày, giờ và số lượng khách\n3. 📝 Điền thông tin liên hệ\n4. ✅ Xác nhận đặt bàn\n\nBạn sẽ nhận được mã QR để check-in khi đến nhà hàng!"
    },
    {
        keywords: ["gọi món", "order", "đặt món", "qr code", "quét mã"],
        answer: "Gọi món tại EatEase rất đơn giản:\n1. 📱 Quét mã QR trên bàn\n2. 🍽️ Chọn món từ thực đơn điện tử\n3. 🛒 Thêm vào giỏ và xác nhận\n4. 👨‍🍳 Bếp sẽ nhận đơn và chuẩn bị món ngay!\n\nBạn có thể theo dõi trạng thái món ăn real-time!"
    },
    {
        keywords: ["thanh toán", "payment", "trả tiền", "pay", "hình thức thanh toán"],
        answer: "EatEase hỗ trợ 2 hình thức thanh toán:\n💵 **Tiền mặt** - Thanh toán trực tiếp tại quầy\n💳 **Online (Stripe)** - Thanh toán qua thẻ/ví điện tử\n\nBạn có thể chọn hình thức thanh toán khi hoàn tất đơn hàng!"
    },
    {
        keywords: ["hủy đặt bàn", "cancel booking", "đổi lịch", "thay đổi đặt bàn", "chính sách hủy"],
        answer: "Chính sách hủy/đổi lịch đặt bàn:\n• ✅ Hủy miễn phí nếu trước **2 giờ**\n• 🔄 Đổi lịch miễn phí nếu trước **4 giờ**\n• ⚠️ Hủy muộn có thể bị tính phí 50% giá trị đặt cọc\n\nLiên hệ support@eatease.vn để được hỗ trợ!"
    },
    {
        keywords: ["giờ mở cửa", "giờ đóng cửa", "mở cửa lúc mấy giờ", "đóng cửa lúc mấy giờ", "hours"],
        answer: "Giờ mở cửa EatEase Restaurant:\n🕐 **10:00 - 22:00** hàng ngày\n📍 Địa chỉ: [Địa chỉ nhà hàng]\n\nChúng tôi phục vụ cả trưa và tối. Đặt bàn trước để có chỗ tốt nhất!"
    },
    {
        keywords: ["voucher", "mã giảm giá", "khuyến mãi", "coupon", "discount code"],
        answer: "EatEase có nhiều voucher hấp dẫn! 🎁\n• 🎉 Voucher chào mừng thành viên mới\n• 🎂 Ưu đãi sinh nhật\n• 💝 Khuyến mãi theo mùa\n\nXem voucher khả dụng tại trang Khuyến mãi hoặc khi thanh toán!"
    },
    {
        keywords: ["liên hệ", "hỗ trợ", "contact", "hotline", "email", "số điện thoại"],
        answer: "Liên hệ EatEase Restaurant:\n📧 Email: support@eatease.vn\n📞 Hotline: [Số điện thoại]\n⏰ Hỗ trợ 9:00 - 22:00 hàng ngày\n\nHoặc chat trực tiếp với nhân viên — chúng tôi luôn sẵn sàng giúp bạn! 😊"
    },
    {
        keywords: ["wifi", "mật khẩu wifi", "password wifi", "kết nối wifi"],
        answer: "📶 EatEase có WiFi miễn phí cho khách hàng!\n\n🔑 Tên mạng: **EatEase_Guest**\n🔒 Mật khẩu: Vui lòng hỏi nhân viên phục vụ tại bàn\n\nChúc bạn có trải nghiệm thoải mái! 😊"
    },
    {
        keywords: ["đỗ xe", "parking", "bãi đỗ xe", "gửi xe", "chỗ đậu xe"],
        answer: "🚗 Thông tin đỗ xe tại EatEase:\n\n• 🏍️ **Xe máy**: Bãi đỗ miễn phí ngay trước nhà hàng\n• 🚗 **Ô tô**: Bãi đỗ cách nhà hàng 50m, có bảo vệ 24/7\n• 💰 Phí gửi xe ô tô: Miễn phí cho khách dùng bữa\n\nNhân viên sẽ hướng dẫn bạn khi đến nhé!"
    },
    {
        keywords: ["dị ứng", "allergy", "không ăn được", "kiêng", "đặc biệt về ăn uống"],
        answer: "⚠️ EatEase rất quan tâm đến sức khỏe của bạn!\n\nNếu bạn có dị ứng thực phẩm, vui lòng:\n1. 📝 Thông báo cho nhân viên khi đặt bàn hoặc gọi món\n2. 🔍 Kiểm tra mô tả món trên thực đơn điện tử\n3. 👨‍🍳 Yêu cầu bếp điều chỉnh nguyên liệu\n\nChúng tôi sẽ cố gắng đáp ứng mọi yêu cầu về ăn uống! 💪"
    },
    {
        keywords: ["thành viên", "member", "đăng ký", "tài khoản", "loyalty", "điểm thưởng", "tích điểm"],
        answer: "🌟 Chương trình thành viên EatEase:\n\n• 🥉 **Bronze** — Đăng ký miễn phí, tích điểm mỗi đơn\n• 🥈 **Silver** — Tích đủ 500 điểm, nhận x1.5 điểm\n• 🥇 **Gold** — Tích đủ 2000 điểm, nhận x2 điểm\n• 💎 **Platinum** — Tích đủ 5000 điểm, nhận x3 điểm\n\n💡 Điểm có thể đổi thành giảm giá trực tiếp khi thanh toán!\nĐăng ký tài khoản ngay trên website để bắt đầu tích điểm! 🎁"
    },
    {
        keywords: ["giao hàng", "delivery", "ship", "mang về", "take away", "takeaway"],
        answer: "📦 Dịch vụ mang về tại EatEase:\n\n• 🏃 **Mang về (Takeaway)**: Đặt món trên website → nhận tại quầy\n• 🛵 **Giao hàng**: Hiện tại EatEase tập trung phục vụ tại nhà hàng\n\n💡 Mẹo: Đặt món trước qua website để tiết kiệm thời gian chờ!"
    },
    {
        keywords: ["tiệc", "nhóm", "party", "tổ chức", "sự kiện", "event", "đông người"],
        answer: "🎉 Đặt tiệc/nhóm tại EatEase:\n\n• 👥 **Nhóm nhỏ (2-6 người)**: Đặt bàn bình thường trên website\n• 👥 **Nhóm lớn (7-15 người)**: Đặt bàn + ghi chú số lượng khách\n• 🎊 **Tiệc/sự kiện**: Liên hệ trực tiếp qua hotline để được tư vấn\n\n📞 Liên hệ sớm để chúng tôi chuẩn bị tốt nhất cho bạn!"
    },
    {
        keywords: ["xem menu", "thực đơn", "có gì ăn", "danh sách món", "các món"],
        answer: "📋 Thực đơn EatEase rất đa dạng!\n\nChúng tôi có:\n🍜 Món Việt truyền thống\n🍕 Món Âu hiện đại\n🍣 Món Á đặc sắc\n🥤 Đồ uống & tráng miệng\n\n💡 Xem thực đơn đầy đủ trên trang **Menu** của website!\nHoặc hỏi tôi về loại món bạn thích — ví dụ: \"món cay\", \"món chay\", \"món nhanh\" 😊"
    },
];

function checkFAQ(message) {
    const lower = message.toLowerCase();
    for (const item of FAQ) {
        // Require at least 2 keywords to match, or 1 keyword with exact phrase match
        const matched = item.keywords.filter(kw => lower.includes(kw));
        if (matched.length >= 2) return item.answer;

        // For single keyword, require exact phrase match (not just substring)
        if (matched.length === 1) {
            const keyword = matched[0];
            // Check if it's a standalone phrase (not part of another word)
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(message)) {
                return item.answer;
            }
        }
    }
    return null;
}

// ─── Server-side rate limiter (per IP) ─────────────────────────────────────
const ipLastRequest = new Map();
const RATE_LIMIT_MS = 4000; // tối thiểu 4 giây giữa 2 request AI cùng 1 IP

// ─── Gemini fallback chain ──────────────────────────────────────────────────
// Skip sang model tiếp theo khi gặp các lỗi quota/unavailable/key issues
const SKIP_STATUSES = new Set([429, 404, 503, 403]);

/**
 * Build dynamic system prompt with menu context + optional user personalization
 */
function buildSystemPrompt(menuData, userContext = null) {
    let prompt = BASE_SYSTEM_PROMPT;

    if (menuData && menuData.items && menuData.items.length > 0) {
        prompt += `\n\n📋 THỰC ĐƠN HIỆN CÓ (${menuData.totalItems} món):\n`;

        if (menuData.isFiltered && menuData.intents && menuData.intents.length > 0) {
            prompt += `(Đã lọc theo: ${menuData.intents.join(", ")})\n\n`;
        }

        menuData.items.forEach((item, index) => {
            prompt += `${index + 1}. **${item.name}**\n`;
            prompt += `   - Danh mục: ${item.category || "Chưa phân loại"}\n`;
            prompt += `   - Giá: ${item.price.toLocaleString('vi-VN')}đ`;

            if (item.discount > 0) {
                prompt += ` → Giảm ${item.discount}% = ${item.finalPrice.toLocaleString('vi-VN')}đ ✨`;
            }
            prompt += `\n`;

            if (item.description) {
                prompt += `   - Mô tả: ${item.description}\n`;
            }

            if (item.preparationTime) {
                prompt += `   - Thời gian: ~${item.preparationTime} phút\n`;
            }

            if (item.isFeatured) {
                prompt += `   - ⭐ Món đặc biệt\n`;
            }

            prompt += `\n`;
        });

        prompt += `\n💡 Hãy tư vấn món ăn từ danh sách trên một cách tự nhiên và hấp dẫn!`;
    } else {
        prompt += `\n\n⚠️ Hiện tại chưa có thông tin menu cụ thể. Hãy giới thiệu tổng quan về nhà hàng và gợi ý khách xem menu trên website.`;
    }

    // Thêm context cá nhân nếu user đã đăng nhập
    if (userContext) {
        prompt += `\n\n👤 THÔNG TIN KHÁCH HÀNG (đã đăng nhập):\n`;
        prompt += `- Tên: ${userContext.name}\n`;
        prompt += `- Hạng thành viên: ${userContext.tierLabel}\n`;
        prompt += `- Điểm thưởng: ${userContext.points.toLocaleString('vi-VN')} điểm\n`;
        if (userContext.recentItems && userContext.recentItems.length > 0) {
            prompt += `- Món đã đặt gần đây: ${userContext.recentItems.join(", ")}\n`;
        }
        prompt += `\n💡 Hãy gọi tên khách hàng, gợi ý dựa trên sở thích trước đó, và nhắc về điểm thưởng khi phù hợp!`;
    }

    return prompt;
}

// ─── Local Smart Reply (không cần Gemini) ───────────────────────────────────
// Tạo câu trả lời tự động từ menu data khi Gemini không khả dụng
function buildLocalSmartReply(message, menuData, userContext = null) {
    const lower = message.toLowerCase();

    // Greeting patterns
    const greetings = ["xin chào", "hello", "hi", "chào", "hey", "alo"];
    if (greetings.some(g => lower.includes(g))) {
        let reply = "";
        if (userContext) {
            reply += `Xin chào ${userContext.name}! 😊 Chào mừng thành viên ${userContext.tierLabel} quay lại EatEase!\n`;
            reply += `🌟 Bạn đang có **${userContext.points.toLocaleString('vi-VN')} điểm** thưởng.\n\n`;
        } else {
            reply += "Xin chào! 😊 Tôi là trợ lý ảo của EatEase Restaurant.\n\n";
        }
        reply += "Tôi có thể giúp bạn:\n";
        reply += "🍽️ Gợi ý món ăn theo sở thích\n";
        reply += "📋 Xem thực đơn & giá cả\n";
        reply += "📅 Hướng dẫn đặt bàn\n";
        reply += "💳 Thông tin thanh toán\n";
        reply += "🌟 Chương trình thành viên & tích điểm\n\n";
        reply += "Bạn muốn tôi giúp gì nào? ✨";
        return reply;
    }

    // Cảm ơn patterns
    const thanks = ["cảm ơn", "thank", "tks", "cám ơn", "thanks"];
    if (thanks.some(t => lower.includes(t))) {
        return "Không có gì ạ! 😊 Cảm ơn bạn đã ghé EatEase Restaurant. Nếu cần gì thêm, đừng ngần ngại hỏi nhé! ✨";
    }

    // Goodbye patterns
    const goodbyes = ["tạm biệt", "bye", "goodbye", "hẹn gặp lại", "see you"];
    if (goodbyes.some(g => lower.includes(g))) {
        return "Hẹn gặp lại bạn tại EatEase! 👋😊\n\nChúc bạn có một ngày tuyệt vời. Đừng quên đặt bàn trước khi đến nhé! 🍽️✨";
    }

    // Price query patterns
    const priceKeywords = ["bao nhiêu", "giá", "price", "cost", "rẻ nhất", "đắt nhất", "tầm giá"];
    const isPriceQuery = priceKeywords.some(k => lower.includes(k));

    // If we have menu data, build a smart reply
    if (menuData && menuData.items && menuData.items.length > 0) {
        let reply = "";

        // Indicate what was searched
        if (menuData.isFiltered && menuData.intents && menuData.intents.length > 0) {
            const intentLabels = {
                spicy: "món cay 🌶️",
                vegetarian: "món chay 🥗",
                light: "món nhẹ 🥙",
                fast: "món nhanh ⚡",
                featured: "món đặc biệt ⭐",
                cheap: "món giá rẻ 💰",
                expensive: "món cao cấp 👑",
            };
            const labels = menuData.intents.map(i => intentLabels[i] || i).join(", ");
            reply += `Tuyệt vời! Đây là các ${labels} mà EatEase đang có:\n\n`;
        } else if (isPriceQuery) {
            reply += "Đây là thông tin giá các món bạn quan tâm:\n\n";
        } else {
            reply += "Dựa trên yêu cầu của bạn, EatEase xin gợi ý các món sau:\n\n";
        }

        // List menu items (max 5 for readability)
        const itemsToShow = menuData.items.slice(0, 5);
        itemsToShow.forEach((item, index) => {
            reply += `${index + 1}. **${item.name}**\n`;
            if (item.category) reply += `   📂 ${item.category}\n`;

            if (item.discount > 0) {
                reply += `   💰 ~~${item.price.toLocaleString('vi-VN')}đ~~ → ${item.finalPrice.toLocaleString('vi-VN')}đ (giảm ${item.discount}%) ✨\n`;
            } else {
                reply += `   💰 ${item.price.toLocaleString('vi-VN')}đ\n`;
            }

            if (item.description) {
                const desc = item.description.length > 80
                    ? item.description.substring(0, 80) + "..."
                    : item.description;
                reply += `   📝 ${desc}\n`;
            }

            if (item.preparationTime) {
                reply += `   ⏱️ ~${item.preparationTime} phút\n`;
            }

            if (item.isFeatured) {
                reply += `   ⭐ Món đặc biệt của nhà hàng\n`;
            }

            reply += "\n";
        });

        if (menuData.items.length > 5) {
            reply += `...và ${menuData.items.length - 5} món khác! Xem đầy đủ tại trang Menu nhé 📋\n\n`;
        }

        // Add price summary if it's a price query
        if (isPriceQuery && menuData.items.length > 0) {
            const prices = menuData.items.map(i => i.discount > 0 ? i.finalPrice : i.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            reply += `💡 Khoảng giá: **${minPrice.toLocaleString('vi-VN')}đ** – **${maxPrice.toLocaleString('vi-VN')}đ**\n\n`;
        }

        reply += "Bạn muốn biết thêm chi tiết về món nào không? 😊";
        return reply;
    }

    // General food queries without menu data
    const foodKeywords = ["món", "ăn", "menu", "thực đơn", "gợi ý", "recommend"];
    if (foodKeywords.some(k => lower.includes(k))) {
        return "Cảm ơn bạn đã quan tâm! 🍽️\n\nHiện tại bạn có thể xem thực đơn đầy đủ trên trang **Menu** của EatEase. Chúng tôi có đa dạng món Việt, món Á và món Âu.\n\nBạn có sở thích cụ thể nào không? Ví dụ:\n🌶️ Món cay\n🥗 Món chay\n⚡ Món nhanh\n💰 Món giá rẻ\n⭐ Món đặc biệt\n\nHãy cho tôi biết để gợi ý phù hợp nhất! 😊";
    }

    // General / non-food fallback
    return "Cảm ơn bạn đã liên hệ EatEase! 😊\n\nTôi có thể giúp bạn:\n🍽️ Gợi ý món ăn (thử hỏi \"có món cay không?\")\n📅 Hướng dẫn đặt bàn\n💳 Thông tin thanh toán\n🌟 Chương trình thành viên & tích điểm\n📞 Liên hệ nhà hàng\n\nBạn cần hỗ trợ về vấn đề gì ạ?";
}

async function sendWithModelFallback(message, formattedHistory, systemPrompt) {
    let lastError;
    for (const modelName of MODEL_FALLBACK_CHAIN) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });
            const chat = model.startChat({ history: formattedHistory });
            const result = await chat.sendMessage(message);
            console.log(`[Chat] Served by: ${modelName}`);
            return result.response.text();
        } catch (error) {
            lastError = error;
            if (SKIP_STATUSES.has(error.status)) {
                console.warn(`[Chat] Model ${modelName} unavailable (${error.status}), trying next...`);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

// ─── Build user context for personalization ────────────────────────────────
const TIER_LABELS = {
    bronze: 'Bronze 🥉',
    silver: 'Silver 🥈',
    gold: 'Gold 🥇',
    platinum: 'Platinum 💎',
};

async function buildUserContext(user) {
    if (!user) return null;
    try {
        const context = {
            name: user.name,
            tierLevel: user.tierLevel || 'bronze',
            tierLabel: TIER_LABELS[user.tierLevel] || 'Bronze 🥉',
            points: user.rewardsPoint || 0,
            recentItems: [],
        };

        // Lấy 3 order gần nhất để gợi ý
        if (user.orderHistory && user.orderHistory.length > 0) {
            const recentOrders = await TableOrderModel.find({
                _id: { $in: user.orderHistory.slice(-3) },
                status: 'completed',
            })
                .select('items')
                .populate('items.productId', 'name')
                .lean();

            const itemNames = new Set();
            recentOrders.forEach(order => {
                order.items?.forEach(item => {
                    if (item.productId?.name) itemNames.add(item.productId.name);
                });
            });
            context.recentItems = [...itemNames].slice(0, 5);
        }

        return context;
    } catch (err) {
        console.warn('[Chat] Failed to build user context:', err.message);
        return null;
    }
}

// ─── Controller ─────────────────────────────────────────────────────────────
export async function chatController(req, res) {
    try {
        const { message, history = [] } = req.body;

        if (!message || typeof message !== "string" || message.trim() === "") {
            return res.status(400).json({
                message: "Tin nhắn không được để trống",
                error: true,
                success: false,
            });
        }

        const text = message.trim();

        // 0. Build user context nếu đã đăng nhập (optional, không block flow)
        const userContext = await buildUserContext(req.user);

        // 1. Thử trả lời từ FAQ local trước (không tốn quota)
        const faqAnswer = checkFAQ(text);
        if (faqAnswer) {
            console.log("[Chat] Served by: local FAQ");
            console.log("[Chat] Message:", text);
            return res.json({
                message: "Thành công",
                error: false,
                success: true,
                data: { reply: faqAnswer },
            });
        }

        console.log("[Chat] FAQ check passed, proceeding to AI...");

        // 2. Rate limit per IP — tránh spam Gemini API
        const ip = req.ip || req.socket?.remoteAddress || "unknown";
        const now = Date.now();
        const lastTime = ipLastRequest.get(ip) || 0;
        const elapsed = now - lastTime;
        if (elapsed < RATE_LIMIT_MS) {
            const waitSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
            return res.status(429).json({
                message: `Vui lòng chờ ${waitSec} giây trước khi gửi tin tiếp theo ⏳`,
                error: true,
                success: false,
            });
        }
        ipLastRequest.set(ip, now);

        // 3. Fetch smart menu based on user message
        let menuData = null;
        try {
            // Detect if user is asking about food/menu
            const isFoodQuery = /món|menu|ăn|thực đơn|đặc biệt|cay|chay|nhẹ|nhanh|rẻ|đắt|giá|bao nhiêu|gợi ý|recommend/i.test(text);

            if (isFoodQuery) {
                console.log("[Chat] Fetching smart menu...");
                menuData = await getSmartMenu(text, { maxItems: 15 });

                // If no items found with intent, try text search
                if (menuData.items.length === 0) {
                    console.log("[Chat] No items from intent, trying text search...");
                    menuData = await searchMenu(text, { maxItems: 10 });
                }

                // If still no items, get featured items
                if (menuData.items.length === 0) {
                    console.log("[Chat] No search results, getting featured items...");
                    menuData = await getFullMenu({ maxItems: 10 });
                }
            } else {
                // For non-food queries, provide limited menu context
                console.log("[Chat] Non-food query, getting featured items...");
                menuData = await getFullMenu({ maxItems: 8 });
            }
        } catch (menuError) {
            console.error("[Chat] Menu fetch error:", menuError);
            // Continue without menu data
        }

        // 4. Build dynamic system prompt with menu
        const systemPrompt = buildSystemPrompt(menuData, userContext);

        // 5. Gọi Gemini với fallback chain → nếu thất bại thì dùng Local Smart Reply
        const formattedHistory = history
            .filter((msg) => msg.role && msg.text)
            .map((msg) => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.text }],
            }));

        let responseText;
        let servedBy = "unknown";

        try {
            responseText = await sendWithModelFallback(text, formattedHistory, systemPrompt);
            servedBy = "gemini";
        } catch (aiError) {
            // Gemini không khả dụng → sử dụng Local Smart Reply
            console.warn("[Chat] All Gemini models failed, falling back to local smart reply");
            console.warn("[Chat] Last AI error:", aiError.status, aiError.message?.substring(0, 100));
            responseText = buildLocalSmartReply(text, menuData, userContext);
            servedBy = "local-smart-reply";
        }

        console.log(`[Chat] Served by: ${servedBy}`);

        return res.json({
            message: "Thành công",
            error: false,
            success: true,
            data: {
                reply: responseText,
                menuItemsCount: menuData?.totalItems || 0,
                isFiltered: menuData?.isFiltered || false
            },
        });
    } catch (error) {
        // Log đầy đủ để debug
        console.error("[Chat] AI error details:", {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            errorDetails: error.errorDetails || error.details,
        });

        if (error.status === 429) {
            // Kiểm tra xem là quota hàng ngày hay rate limit ngắn hạn
            const isQuotaExceeded =
                error.message?.includes('quota') ||
                error.message?.includes('RESOURCE_EXHAUSTED') ||
                error.errorDetails?.some?.(d => d.reason === 'RATE_LIMIT_EXCEEDED');

            const userMsg = isQuotaExceeded
                ? "Hệ thống AI đang quá tải, vui lòng thử lại sau vài phút! ⏳"
                : "Vui lòng chờ vài giây trước khi gửi tin tiếp theo ⏳";

            return res.status(429).json({
                message: userMsg,
                error: true,
                success: false,
            });
        }

        if (error.status === 400) {
            console.error("[Chat] Bad request to Gemini — possible invalid history format");
        }

        return res.status(500).json({
            message: "Lỗi kết nối AI. Vui lòng thử lại sau.",
            error: true,
            success: false,
        });
    }
}