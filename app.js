require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
app.use(cors({ origin: 'https://deluxe-cat-b99416.netlify.app' }));

app.use(bodyParser.json());

const db_name = "RutuChakra";
const db_collection = "Users";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db(db_name);
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

const emailOtps = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post("/api/send-email-otp", async (req, res) => {
  const { email } = req.body;

  const existingUser = await db
    .collection(db_collection)
    .findOne({ email: email });

  if (existingUser) {
    if (existingUser.email === email) {
      return res.status(400).json({ message: "Email already registered" });
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  emailOtps[email] = otp;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Email Verification OTP",
    text: `Your OTP for email verification is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "OTP sent to email successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending OTP" });
  }
});

app.post("/api/verify-email-otp", (req, res) => {
  const { email, otp } = req.body;

  if (emailOtps[email] === otp) {
    delete emailOtps[email];
    res.json({ message: "Email verified successfully" });
  } else {
    res.status(400).json({ message: "Invalid OTP" });
  }
});

  app.post("/api/submit-details", async (req, res) => {
    const { firstName, lastName, email, phone, dob } = req.body;

    if (phone.length !== 10) {
      return res.status(400).json({ message: "Phone number must be 10 digits" });
    }

    try {
      const existingUser = await db.collection(db_collection).findOne({
        $or: [{ phone: phone }, { email: email }],
      });

      if (existingUser) {
        if (existingUser.phone === phone) {
          return res
            .status(400)
            .json({ message: "Phone number already registered" });
        }
        if (existingUser.email === email) {
          return res.status(400).json({ message: "Email already registered" });
        }
      }

      const now = new Date();
      const formattedTime = `${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}${now
        .getHours()
        .toString()
        .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
        .getSeconds()
        .toString()
        .padStart(2, "0")}`.slice(-6);

      const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();

      const userId = capitalizedName + formattedTime;

      const dobParts = dob.split("-");
      const password = `${dobParts[2]}${dobParts[1]}${dobParts[0].slice(-2)}`;

      const newUser = {
        firstName:capitalizedName,
        lastName:capitalizedLastName,
        email,
        phone,
        dob,
        userId,
        password,
      };

      const result = await db.collection(db_collection).insertOne(newUser);
      res.json({
        message: "User registered successfully",
        userId: newUser.userId,
      });
    } catch (error) {
      console.error("Error inserting user:", error);
      res.status(500).json({ message: "Error registering user" });
    }
  });

async function startServer() {
  await connectToDatabase();

  const PORT = process.env.PORT;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(console.error);

process.on("SIGINT", async () => {
  await client.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});
