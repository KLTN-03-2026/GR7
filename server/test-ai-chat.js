/**
 * Test script for AI Chatbot Phase 1
 * 
 * Usage:
 * node test-ai-chat.js
 */

import { getSmartMenu, getFullMenu, searchMenu } from "./services/menu.service.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("✅ Connected to MongoDB");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
}

// Test cases
const TEST_CASES = [
    {
        name: "Test 1: Món cay",
        message: "Có món nào cay không?",
        expectedIntents: ["spicy"]
    },
    {
        name: "Test 2: Món chay",
        message: "Tôi ăn chay, có món gì phù hợp?",
        expectedIntents: ["vegetarian"]
    },
    {
        name: "Test 3: Món nhanh",
        message: "Tôi đang gấp, món nào nhanh nhất?",
        expectedIntents: ["fast"]
    },
    {
        name: "Test 4: Món đặc biệt",
        message: "Món đặc biệt của nhà hàng là gì?",
        expectedIntents: ["featured"]
    },
    {
        name: "Test 5: Món rẻ",
        message: "Món nào rẻ nhất?",
        expectedIntents: ["cheap"]
    },
    {
        name: "Test 6: Món đắt/cao cấp",
        message: "Món cao cấp nhất là gì?",
        expectedIntents: ["expensive"]
    },
    {
        name: "Test 7: Tổng hợp - Món chay nhẹ",
        message: "Món chay nhẹ nhẹ",
        expectedIntents: ["vegetarian", "light"]
    },
    {
        name: "Test 8: Không có intent",
        message: "Giới thiệu món ngon",
        expectedIntents: []
    }
];

// Run tests
async function runTests() {
    console.log("\n🧪 Starting AI Chatbot Tests...\n");
    console.log("=".repeat(80));
    
    for (const testCase of TEST_CASES) {
        console.log(`\n${testCase.name}`);
        console.log(`Message: "${testCase.message}"`);
        console.log("-".repeat(80));
        
        try {
            const result = await getSmartMenu(testCase.message, { maxItems: 5 });
            
            console.log(`✅ Detected intents: ${result.intents.join(", ") || "none"}`);
            console.log(`✅ Found ${result.totalItems} items`);
            console.log(`✅ Filtered: ${result.isFiltered}`);
            
            if (result.items.length > 0) {
                console.log("\n📋 Sample items:");
                result.items.slice(0, 3).forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.name}`);
                    console.log(`      Category: ${item.category}`);
                    console.log(`      Price: ${item.price.toLocaleString('vi-VN')}đ${item.discount > 0 ? ` → ${item.finalPrice.toLocaleString('vi-VN')}đ (-${item.discount}%)` : ''}`);
                    if (item.preparationTime) {
                        console.log(`      Time: ~${item.preparationTime} min`);
                    }
                    if (item.isFeatured) {
                        console.log(`      ⭐ Featured`);
                    }
                });
            } else {
                console.log("⚠️  No items found");
            }
            
            // Verify expected intents
            const expectedSet = new Set(testCase.expectedIntents);
            const actualSet = new Set(result.intents);
            const match = testCase.expectedIntents.every(intent => actualSet.has(intent));
            
            if (testCase.expectedIntents.length > 0) {
                if (match) {
                    console.log(`✅ Intent detection: PASS`);
                } else {
                    console.log(`❌ Intent detection: FAIL`);
                    console.log(`   Expected: ${testCase.expectedIntents.join(", ")}`);
                    console.log(`   Got: ${result.intents.join(", ")}`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error:`, error.message);
        }
        
        console.log("=".repeat(80));
    }
    
    // Test text search
    console.log("\n🔍 Testing Text Search...\n");
    console.log("=".repeat(80));
    
    const searchTests = [
        "phở",
        "bún",
        "cơm",
        "salad"
    ];
    
    for (const searchText of searchTests) {
        console.log(`\nSearching for: "${searchText}"`);
        console.log("-".repeat(80));
        
        try {
            const result = await searchMenu(searchText, { maxItems: 3 });
            console.log(`✅ Found ${result.totalItems} items`);
            
            if (result.items.length > 0) {
                result.items.forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.name} - ${item.finalPrice.toLocaleString('vi-VN')}đ`);
                });
            }
        } catch (error) {
            console.error(`❌ Error:`, error.message);
        }
    }
    
    console.log("\n" + "=".repeat(80));
    
    // Test full menu
    console.log("\n📋 Testing Full Menu (Featured Items)...\n");
    console.log("=".repeat(80));
    
    try {
        const result = await getFullMenu({ maxItems: 5 });
        console.log(`✅ Found ${result.totalItems} items`);
        console.log(`✅ Filtered: ${result.isFiltered}`);
        
        if (result.items.length > 0) {
            result.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.name}${item.isFeatured ? ' ⭐' : ''}`);
                console.log(`      ${item.finalPrice.toLocaleString('vi-VN')}đ`);
            });
        }
    } catch (error) {
        console.error(`❌ Error:`, error.message);
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("\n✅ All tests completed!\n");
}

// Main
async function main() {
    await connectDB();
    await runTests();
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
}

main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
