const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/config");
const route = require("./routes/route");

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/", route);

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
