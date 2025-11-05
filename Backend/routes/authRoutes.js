// Backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken"); // Import JWT
const User = require("../models/User");
const rateLimit = require("express-rate-limit");
const CryptoJS = require("crypto-js");
const SECRET_KEY = "YourStrongFrontendSecretKey123"; // Must match frontend AES key

// 🕒 Rate limiter to prevent brute force login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    status: 429,
    message: "Too many login attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 min
//   max: 5, // only 5 login attempts per IP per 15 minutes
//   message: {
//     status: 429,
//     message: 'Too many login attempts. Please try again later.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });


// Register Route
router.post("/register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      idNumber,
      accountNumber,
      username,
      email,
      password,
      phoneNumber,
      country,
      address,
      city,
      postalCode,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !idNumber ||
      !accountNumber ||
      !username
    ) {
      console.log("❌ Missing required fields during registration");
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("⚠️ Registration blocked — email already registered:", email);
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("🔐 Password successfully hashed for:", email);

    const newUser = new User({
      firstName,
      lastName,
      idNumber,
      accountNumber,
      username,
      email,
      password: hashedPassword,
      phoneNumber,
      country,
      address,
      city,
      postalCode,
      role: role || "user", // fallback to "user" if undefined
    });

    await newUser.save();

    console.log("✅ User registered successfully:", username);
    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("💥 Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// 🟡 Login Route
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, accountNumber, password } = req.body;

    console.log("🟢 Login attempt received:");
    console.log("   Username:", username);
    console.log("   Account Number:", accountNumber);
    console.log("   Encrypted Password:", password);

    if (!username || !password || !accountNumber) {
      console.log("❌ Missing login credentials");
      return res
        .status(400)
        .json({ message: "Missing username, account number or password" });
    }

    const user = await User.findOne({ accountNumber, username });
    if (!user) {
      console.log("❌ No user found for username:", username);
      return res.status(404).json({ message: "User not found" });
    }

    // 🧩 Decrypt AES password from frontend
    const decryptedPassword = CryptoJS.AES.decrypt(
      password,
      SECRET_KEY
    ).toString(CryptoJS.enc.Utf8);

    console.log("🔓 Decrypted password received from frontend:", decryptedPassword);

    // 🔐 Compare decrypted password with hashed password in database
    const isMatch = await bcrypt.compare(decryptedPassword, user.password);
    console.log("🧠 Bcrypt comparison result:", isMatch);

    if (!isMatch) {
      console.log("❌ Invalid credentials for user:", username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "DefaultJWTSecretKey123",
      { expiresIn: "1h" }
    );

    console.log("🎫 JWT token generated for user:", username);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        accountNumber: user.accountNumber,
        idNumber: user.idNumber,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    console.error("💥 Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

module.exports = router;
