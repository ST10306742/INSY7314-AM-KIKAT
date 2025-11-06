// Backend/seed/seedEmployees.js
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seedEmployees() {
  try {
    // Check if any employees already exist
    const existingEmployees = await User.find({ role: "employee" });

    if (existingEmployees.length > 0) {
      console.log(`${existingEmployees.length} employee(s) already exist. Skipping seeding.`);
      return;
    }

    console.log("No employees found — seeding default employee accounts...");

    // Hash passwords
    const hashedPassword = await bcrypt.hash("password123", 10);

    const employees = [
      {
        firstName: "John",
        lastName: "Doe",
        idNumber: "EMP001",
        accountNumber: "1234567890",
        username: "john_doe",
        email: "john.doe@example.com",
        password: hashedPassword,
        phoneNumber: "0712345678",
        country: "South Africa",
        address: "123 Main Road",
        city: "Durban",
        postalCode: "4001",
        role: "employee",
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        idNumber: "EMP002",
        accountNumber: "7410852096374108520",
        username: "jane_smith",
        email: "jane.smith@example.com",
        password: hashedPassword,
        phoneNumber: "0798765432",
        country: "South Africa",
        address: "456 Beach Road",
        city: "Cape Town",
        postalCode: "8000",
        role: "employee",
      },
    ];

    await User.insertMany(employees);

    console.log("Employees seeded successfully!");
  } catch (error) {
    console.error("Error seeding employees:", error);
  }
}

module.exports = seedEmployees;
