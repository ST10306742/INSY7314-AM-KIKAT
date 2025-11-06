// routes/employeePaymentsRoutes.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");
const router = express.Router();
const Payment = require("../models/Payment"); // We'll make this model next
const User = require("../models/User");

//  GET all employee payments filtered by verified status
router.get("/getall", authenticate, authorizeRoles("employee"), async (req, res) => {
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
router.post("/verify-account", authenticate, authorizeRoles("employee"), async (req, res) => {
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
router.post("/verify-swift", authenticate, authorizeRoles("employee"), async (req, res) => {
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


// PATCH /api/employeepayments/update-verification
router.patch("/update-verification", authenticate, authorizeRoles("employee"), async (req, res) => {
    try {
        const { _id, accountsVerified, swiftCodeVerified } = req.body;

        // Validate request
        if (!_id || typeof accountsVerified !== "boolean" || typeof swiftCodeVerified !== "boolean") {
            return res.status(400).json({
                message: "Missing or invalid fields. Expected _id, accountsVerified, and swiftCodeVerified (booleans).",
            });
        }

        // If any check fails, return unverified message
        if (!accountsVerified || !swiftCodeVerified) {
            return res.status(400).json({
                verified: false,
                message: "Unverified: one or more checks failed.",
            });
        }

        // Update the record in MongoDB
        const updatedPayment = await Payment.findByIdAndUpdate(
            _id,
            { verified: true, reason: "Verified successfully" },
            { new: true } // return updated document
        );

        if (!updatedPayment) {
            return res.status(404).json({ message: "Payment record not found." });
        }

        res.status(200).json({
            message: "Payment verification status updated successfully.",
            payment: updatedPayment,
        });
    } catch (error) {
        console.error("Error updating payment verification:", error);
        res.status(500).json({
            message: "Server error while updating payment verification.",
            error: error.message,
        });
    }
});
router.patch("/unverify", async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) {
            return res.status(400).json({ message: "Missing _id in request body." });
        }

        const updatedPayment = await Payment.findByIdAndUpdate(
            _id,
            { verified: false, reason: "Unverified by employee" },
            { new: true }
        );

        if (!updatedPayment) {
            return res.status(404).json({ message: "Payment record not found." });
        }

        res.status(200).json({ message: "Payment unverified successfully.", payment: updatedPayment });
    } catch (error) {
        console.error("Error un-verifying payment:", error);
        res.status(500).json({ message: "Server error while un-verifying payment.", error: error.message });
    }
});

// PATCH /api/employeepayments/submit-to-swift
router.patch("/submit-to-swift", authenticate, authorizeRoles("employee"), async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).json({ message: "Missing _id in request body." });
    }

    const payment = await Payment.findById(_id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found." });
    }

    // Only allow submitting verified payments
    if (!payment.verified) {
      return res.status(400).json({ message: "Cannot submit unverified payment to SWIFT." });
    }

    payment.submitted = true;
    payment.reason = "Submitted to SWIFT successfully.";
    payment.swiftResponse = { status: "submitted", timestamp: new Date() };

    const updated = await payment.save();

    res.status(200).json({
      message: "Payment successfully submitted to SWIFT.",
      payment: updated,
    });
  } catch (error) {
    console.error("Error submitting to SWIFT:", error);
    res.status(500).json({
      message: "Server error while submitting to SWIFT.",
      error: error.message,
    });
  }
});

// DELETE /api/employeepayments/delete
// Accepts body { _id } or query ?id=...
router.delete("/delete", authenticate, authorizeRoles("employee"), async (req, res) => {
  try {
    const idFromQuery = req.query.id;
    const { _id } = req.body || {};
    const id = _id || idFromQuery;

    if (!id) {
      return res.status(400).json({ message: "Missing _id (or id query) in request." });
    }

    const deleted = await Payment.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Payment record not found." });
    }

    res.status(200).json({ message: "Payment deleted successfully.", payment: deleted });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ message: "Server error while deleting payment.", error: error.message });
  }
});

// POST /delete-multiple (bulk delete)
router.post("/delete-multiple", authenticate, authorizeRoles("employee"), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Missing or invalid 'ids' array in request body." });
    }
    const result = await Payment.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: `Deleted ${result.deletedCount} record(s).`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error bulk deleting payments:", error);
    res.status(500).json({ message: "Server error while deleting payments.", error: error.message });
  }
});

module.exports = router;
