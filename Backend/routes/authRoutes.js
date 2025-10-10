// Backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// 🟢 Register Route
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

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !idNumber || !accountNumber || !username) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
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
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// 🟡 Login Route
router.post("/login", async (req, res) => {
  try {
    const { username, accountNumber, password } = req.body;

    // Validate fields
    if (!username || !password || !accountNumber) {
      return res.status(400).json({ message: "Missing username, account number or password" });
    }

    const user = await User.findOne({ accountNumber, username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({
      message: "Login successful",
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
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

module.exports = router;
