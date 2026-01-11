// server.js
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ===============================
// IN-MEMORY DATA STORES
// ===============================
const activeQRSessions = {};
const attendanceRecords = [];

// ===============================
// SUBJECT LIST
// ===============================
const subjects = [
  "Data Structures",
  "SQL",
  "Java",
  "Python",
  "Computer Networks",
  "Operating System"
];

// ===============================
// GET SUBJECTS
// ===============================
app.get("/subjects", (req, res) => res.json(subjects));

// ===============================
// START QR (initial start)
// ===============================
app.post("/start-qr", (req, res) => {
  const { subject } = req.body;
  if (!subject) return res.status(400).json({ message: "Subject required" });

  const token = uuidv4();
  activeQRSessions[subject] = { token, active: true, startedAt: new Date() };

  console.log(`🟢 QR STARTED for ${subject}: ${token}`);
  res.json({ subject, token });
});

// ===============================
// REFRESH QR (every 10s)
// ===============================
app.post("/refresh-qr", (req, res) => {
  const { subject } = req.body;
  const session = activeQRSessions[subject];

  if (!subject || !session || !session.active) {
    return res.status(400).json({ message: "Invalid or inactive subject" });
  }

  const token = uuidv4();
  session.token = token;
  session.startedAt = new Date();

  console.log(`🔄 QR REFRESHED for ${subject}: ${token}`);
  res.json({ subject, token });
});

// ===============================
// STOP QR
// ===============================
app.post("/stop-qr", (req, res) => {
  const { subject } = req.body;
  const session = activeQRSessions[subject];

  if (!subject || !session) return res.status(400).json({ message: "Invalid subject" });

  session.active = false;
  console.log(`🔴 QR STOPPED for ${subject}`);
  res.json({ message: "QR stopped" });
});

// ===============================
// MARK ATTENDANCE
// ===============================
// MARK ATTENDANCE
// MARK ATTENDANCE BY EMAIL
app.post("/mark-attendance", (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email required" });

  const now = new Date();
  const record = {
    email,
    date: now.toLocaleDateString("en-IN"),
    time: now.toLocaleTimeString("en-IN"),
  };

  attendanceRecords.push(record);
  console.log(`✅ ${email} marked at ${record.time}`);

  res.json({ message: "Attendance marked", email });
});

// ===============================
// VIEW ATTENDANCE
// ===============================
app.get("/attendance-records", (req, res) => res.json(attendanceRecords));

// ===============================
// SERVER START
// ===============================
app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
