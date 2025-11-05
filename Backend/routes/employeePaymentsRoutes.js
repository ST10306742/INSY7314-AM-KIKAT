// routes/employeePaymentsRoutes.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const Payment = require("../models/Payment"); // We'll make this model next
const User = require("../models/User");

//  GET all employee payments filtered by verified status
router.get("/getall", async (req, res) => {
    try {
        // Read the filter from query params (example: /api/employeepayments?verified=true)
        const { verified } = req.query;

        // Build the filter
        const filter = {};
        if (verified === "true") filter.verified = true;
        else if (verified === "false") filter.verified = false;

        // Fetch from MongoDB
        const payments = await Payment.find(filter).sort({ paymentDate: -1 });

        res.status(200).json(payments);
    } catch (error) {
        console.error("Error fetching employee payments:", error);
        res.status(500).json({ message: "Server error while fetching employee payments" });
    }
});



// POST verify account information
router.post("/verify-account", async (req, res) => {
    try {
        const { accountNumber, senderEmail, accountInfo, receiverEmail } = req.body;

        // Check for missing fields
        if (!accountNumber || !senderEmail || !accountInfo || !receiverEmail) {
            return res.status(400).json({
                message: "Missing required fields. Please provide accountNumber, senderEmail, receiverEmail, and accountInfo.",
            });
        }

        let verificationResult = {
            verified: false,
            message: "",
        };

        // Check sender user
        const senderUser = await User.findOne({ email: senderEmail });
        if (!senderUser) {
            verificationResult.message = "Sender email not found in system.";
            return res.status(404).json(verificationResult);
        }

        if (senderUser.accountNumber !== accountNumber) {
            verificationResult.message = "Sender account number does not match the provided email.";
            return res.status(400).json(verificationResult);
        }

        // Check receiver user
        const receiverUser = await User.findOne({ email: receiverEmail });
        if (!receiverUser) {
            verificationResult.message = "Receiver email not found in system.";
            return res.status(404).json(verificationResult);
        }

        if (receiverUser.accountNumber !== accountInfo) {
            verificationResult.message = "Receiver account number does not match records.";
            return res.status(400).json(verificationResult);
        }

        verificationResult.verified = true;
        verificationResult.message = "Both sender and receiver verified successfully.";

        res.status(200).json(verificationResult);
    } catch (error) {
        // console.error("Error verifying account:", error);
        // res.status(500).json({ message: "Server error while verifying account information." });
        console.error("Error verifying account:", error.message, error.stack);
        res.status(500).json({ message: error.message });
    }
});



// Load SWIFT codes JSON once at startup
let swiftData = [];
try {
  const filePath = path.join(__dirname, "..//AllCountries_v3.json"); // adjust path if needed
  const rawData = fs.readFileSync(filePath, "utf8");
  swiftData = JSON.parse(rawData);
  console.log(`Loaded ${swiftData.length} SWIFT records`);
} catch (err) {
  console.error("Failed to load SWIFT JSON file:", err.message);
}



// 🔹 POST /api/employeepayments/verify-swift
router.post("/verify-swift", async (req, res) => {
  try {
    const { swiftCode } = req.body;

    if (!swiftCode) {
      return res.status(400).json({
        valid: false,
        message: "Missing SWIFT code in request body.",
      });
    }

    // Normalize case
    const code = swiftCode.trim().toUpperCase();

    // Check if it exists in the dataset
    const exists = swiftData.some((b) => b.bic === code);

    if (exists) {
      return res.status(200).json({
        valid: true,
        message: "SWIFT code is valid.",
      });
    } else {
      return res.status(404).json({
        valid: false,
        message: "SWIFT code not valid or not found.",
      });
    }
  } catch (error) {
    console.error("Error verifying SWIFT code:", error);
    res.status(500).json({
      valid: false,
      message: "Server error while verifying SWIFT code.",
    });
  }
});


module.exports = router;
