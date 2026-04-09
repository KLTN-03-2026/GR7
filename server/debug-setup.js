/**
 * Debug script to check setup
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductModel from "./models/product.model.js";
import CategoryModel from "./models/category.model.js";

dotenv.config();

console.log("\n🔍 Checking Setup...\n");
console.log("=".repeat(80));

// Check environment variables
console.log("\n1️⃣ Environment Variables:");
console.log("-".repeat(80));
console.log(`MONGODB_URL: ${process.env.MONGODB_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);

if (!process.env.MONGODB_URL) {
    console.log("\n❌ MONGODB_URL is missing in .env file!");
    console.log("Add this to your .env:");
    console.log("MONGODB_URL=mongodb://localhost:27017/eatease");
    process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
    console.log("\n⚠️  GEMINI_API_KEY is missing in .env file!");
    console.log("Add this to your .env:");
    console.log("GEMINI_API_KEY=your_api_key_here");
    console.log("\nGet your API key from: https://makersuite.google.com/app/apikey");
}

// Check database connection
console.log("\n2️⃣ Database Connection:");
console.log("-".repeat(80));

try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Connected to MongoDB");
    
    // Check products
    console.log("\n3️⃣ Database Content:");
    console.log("-".repeat(80));
    
    const totalProducts = await ProductModel.countDocuments();
    console.log(`Total products: ${totalProducts}`);
    
    const publishedProducts = await ProductModel.countDocuments({ publish: true });
    console.log(`Published products: ${publishedProducts}`);
    
    const availableProducts = await ProductModel.countDocuments({ 
        publish: true, 
        status: 'available' 
    });
    console.log(`Available products: ${availableProducts}`);
    
    if (availableProducts === 0) {
        console.log("\n⚠️  No available products found!");
        console.log("AI chatbot needs products in database to work properly.");
        console.log("\nPlease add some products with:");
        console.log("- publish: true");
        console.log("- status: 'available'");
    } else {
        console.log("\n✅ Database has products!");
        
        // Show sample products
        const sampleProducts = await ProductModel.find({ 
            publish: true, 
            status: 'available' 
        })
            .limit(5)
            .select('name price category description')
            .populate('category', 'name');
        
        console.log("\n📋 Sample Products:");
        sampleProducts.forEach((p, i) => {
            const categoryNames = p.category.map(c => c.name).join(", ");
            console.log(`   ${i + 1}. ${p.name}`);
            console.log(`      Category: ${categoryNames}`);
            console.log(`      Price: ${p.price.toLocaleString('vi-VN')}đ`);
            if (p.description) {
                console.log(`      Description: ${p.description.substring(0, 50)}...`);
            }
        });
    }
    
    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("\n📊 Summary:");
    console.log("-".repeat(80));
    
    const issues = [];
    if (!process.env.GEMINI_API_KEY) issues.push("Missing GEMINI_API_KEY");
    if (availableProducts === 0) issues.push("No available products");
    
    if (issues.length === 0) {
        console.log("✅ All checks passed! You're ready to test the AI chatbot.");
        console.log("\nNext steps:");
        console.log("1. Start server: npm run dev");
        console.log("2. Open browser and test chatbot");
        console.log("3. Try questions like:");
        console.log("   - 'Món đặc biệt của nhà hàng?'");
        console.log("   - 'Có món nào cay không?'");
        console.log("   - 'Món chay có gì?'");
    } else {
        console.log("⚠️  Issues found:");
        issues.forEach(issue => console.log(`   - ${issue}`));
        console.log("\nPlease fix these issues before testing.");
    }
    
} catch (error) {
    console.error("\n❌ Error:", error.message);
} finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB\n");
}
