
const QRCode = require("qrcode");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const { v4: uuidv4 } = require("uuid");
const Parser = require("parser");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// ===============================
// SINGLE DATABASE CONNECTION
// ===============================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Vani@1234", // your MySQL password
  database: "smart_attendance"
});

db.connect(err => {
  if (err) return console.error("❌ MySQL connection failed:", err);
  console.log("✅ MySQL Connected");
});

// ===============================
// GLOBAL DATA
// ===============================
const subjects = ["java", "python", "sql", "ds", "cn", "os"];
const activeQRSessions = {};


// ===============================
// TEACHER REGISTRATION
// ===============================
app.post("/api/teachers/register", (req, res) => {
  const { name, email, phone } = req.body;

  // Validate input
  if (!name || !email || !phone) {
    return res.status(400).json({ message: "All fields required" });
  }

  // Trim and normalize inputs
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();

  const sql = `INSERT INTO admins (name, email, phone) VALUES (?, ?, ?)`;

  db.query(sql, [trimmedName, trimmedEmail, trimmedPhone], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Teacher already exists" });
      }
      return res.status(500).json({ message: "Database error", error: err });
    }

    res.json({ success: true, message: "Teacher registered successfully" });
  });
});

// ===============================
// TEACHER LOGIN
// ===============================
app.post("/teacher-login", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const trimmedEmail = email.trim().toLowerCase(); // normalize

  const sql = "SELECT admin_id, name, email, phone FROM admins WHERE email = ?";
  db.query(sql, [trimmedEmail], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Email exists, allow login
    res.json({ success: true, teacher: results[0], message: "Login successful" });
  });
});


// ===============================
// STUDENT REGISTRATION
// ===============================
app.post("/api/students/register", (req, res) => {
  const { rollno, name, email, phone } = req.body;

  if (!rollno || !name || !email || !phone)
    return res.status(400).json({ message: "All fields required" });

  const sql = `INSERT INTO students_attendance (rollno, name, email, phone) VALUES (?, ?, ?, ?)`;

  db.query(sql, [rollno, name, email, phone], err => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res.status(409).json({ message: "Student already exists" });
      return res.status(500).json({ message: "DB error", error: err });
    }
    res.json({ success: true, message: "Student registered" });
  });
});

// ===============================
// STUDENT LOGIN
// ===============================
app.post("/student-login", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Trim the email to remove extra spaces
  const trimmedEmail = email.trim();

  const sql = "SELECT * FROM students_attendance WHERE rollno = ?";
  db.query(sql, [trimmedEmail], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Email exists, allow login
    res.json({ success: true, student: results[0], message: "Login successful" });
  });
});



// ===============================
// START QR / INCREMENT TOTAL
// ===============================
app.post("/start-qr", async (req, res) => {
  let { subject } = req.body;
  subject = subject.toLowerCase();   // ✅ ADD THIS

  if (!subjects.includes(subject))
    return res.status(400).json({ message: "Invalid subject" });

  const token = uuidv4();
  activeQRSessions[subject] = { token, active: true };

  try {
    const qrData = `${subject}-${token}`;
    const qrImage = await QRCode.toDataURL(qrData);
    res.json({ qrImage });           // ✅ IMPORTANT
  } catch (err) {
    res.status(500).json({ message: "QR generation failed" });
  }
});

// ===============================
// STOP QR
// ===============================
app.post("/stop-qr", (req, res) => {
  let { subject } = req.body;
  subject = subject.toLowerCase();   // ✅ ADD THIS

  if (activeQRSessions[subject])
    activeQRSessions[subject].active = false;

  res.json({ message: "QR stopped" });
});
 


// ====================================refresh qr
app.post("/refresh-qr", async (req, res) => {
  let { subject } = req.body;
  subject = subject.toLowerCase();   // ✅ ADD THIS

  if (!activeQRSessions[subject]?.active)
    return res.status(400).json({ message: "QR not active" });

  const token = uuidv4();
  activeQRSessions[subject].token = token;

  const qrData = `${subject}-${token}`;
  const qrImage = await QRCode.toDataURL(qrData);
  res.json({ qrImage });
});


// ===============================
// MARK ATTENDANCE
// ===============================
// app.post("/mark-attendance", (req, res) => {

//   let { rollno, subject, token } = req.body;

//   if (!rollno || !subject || !token)
//     return res.status(400).json({ message: "Invalid data" });

//   subject = subject.toLowerCase();

//   if (!subjects.includes(subject))
//     return res.status(400).json({ message: "Invalid subject" });

//   const session = activeQRSessions[subject];

//   if (!session || !session.active)
//     return res.status(403).json({ message: "QR inactive" });

//   // 🔥 VALIDATE TOKEN
//   const expectedQR = `${subject}-${session.token}`;

//   if (token !== expectedQR)
//     return res.status(403).json({ message: "Invalid QR code" });

//   const sql = `UPDATE students_attendance 
//                SET ${subject}_present = ${subject}_present + 1 
//                WHERE rollno = ?`;

//   db.query(sql, [rollno], (err, result) => {
//     if (err) return res.status(500).json({ message: "DB error" });

//     if (result.affectedRows === 0)
//       return res.status(404).json({ message: "Student not found" });

//     res.json({ message: "Attendance marked" });
//   });

// });





// app.post("/mark-attendance", (req, res) => {

//   let { rollno, subject, token } = req.body;

//   if (!rollno || !subject || !token)
//     return res.status(400).json({ message: "Invalid data" });

//   subject = subject.toLowerCase();

//   if (!subjects.includes(subject))
//     return res.status(400).json({ message: "Invalid subject" });

//   const session = activeQRSessions[subject];

//   if (!session || !session.active)
//     return res.status(403).json({ message: "QR inactive" });

//   const expectedQR = `${subject}-${session.token}`;

//   if (token !== expectedQR)
//     return res.status(403).json({ message: "Invalid QR code" });

//   // ✅ STEP 1: Check last attendance date
//   const checkSql = `SELECT ${subject}_last_date FROM students_attendance WHERE rollno = ?`;

//   db.query(checkSql, [rollno], (err, results) => {
//     // if (err) return res.status(500).json({ message: "DB error" });
//     if (err) {
//   console.log("CHECK ERROR:", err);
//   return res.status(500).json({ message: "DB error" });
// }

//     if (results.length === 0)
//       return res.status(404).json({ message: "Student not found" });

//     // const lastDate = results[0][`${subject}_last_date`];

//     // const today = new Date().toISOString().split("T")[0];

//     // // ✅ STEP 2: Compare dates
//     // if (lastDate && lastDate.toISOString().split("T")[0] === today) {
//     //   return res.json({ message: "Attendance already marked today" });
//     // }
//     const lastDate = results[0][`${subject}_last_date`];
// const today = new Date().toISOString().split("T")[0];

// if (lastDate) {
//   const formattedDate = new Date(lastDate).toISOString().split("T")[0];

//   if (formattedDate === today) {
//     return res.json({ message: "Attendance already marked today" });
//   }
// }

//     // ✅ STEP 3: Update attendance
//     const updateSql = `
//       UPDATE students_attendance
//       SET ${subject}_present = ${subject}_present + 1,
//           ${subject}_total = ${subject}_total + 1,
//           ${subject}_last_date = CURDATE()
//       WHERE rollno = ?`;

//     db.query(updateSql, [rollno], (err2) => {
//       // if (err2) return res.status(500).json({ message: "DB error" });
//       if (err2) {
//   console.log("UPDATE ERROR:", err2);
//   return res.status(500).json({ message: "DB error" });
// }

//       res.json({ message: "Attendance marked successfully" });
//     });

//   });

// });



app.post("/mark-attendance", (req, res) => {

  let { rollno, subject, token } = req.body;

  if (!rollno || !subject || !token)
    return res.status(400).json({ message: "Invalid data" });

  subject = subject.trim().toLowerCase();

  if (!subjects.includes(subject))
    return res.status(400).json({ message: "Invalid subject" });

  const session = activeQRSessions[subject];

  if (!session || !session.active)
    return res.status(403).json({ message: "QR inactive" });

  const expectedQR = `${subject}-${session.token}`;

  if (token !== expectedQR)
    return res.status(403).json({ message: "Invalid QR code" });

  // 🔥 IMPORTANT: Let MySQL block duplicate attendance
  // const sql = `
  //   UPDATE students_attendance
  //   SET ${subject}_present = ${subject}_present + 1,
  //       ${subject}_total = ${subject}_total + 1,
  //       ${subject}_last_date = CURDATE()
  //   WHERE rollno = ?
  //   AND (${subject}_last_date IS NULL OR ${subject}_last_date != CURDATE())
  // `;
  const sql = `
  UPDATE students_attendance
  SET ${subject}_present = ${subject}_present + 1,
      ${subject}_total = ${subject}_total + 1,
      ${subject}_last_date = CURDATE()
  WHERE rollno = ?
  AND (
        ${subject}_last_date IS NULL 
        OR DATE(${subject}_last_date) != CURDATE()
      )
`;

  db.query(sql, [rollno], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).json({ message: "DB error" });
    }

    if (result.affectedRows === 0) {
      return res.json({ message: "Attendance already marked today" });
    }

    res.json({ message: "Attendance marked successfully" });

  });

});

// ===============================
// GET ATTENDANCE RECORDS
// ===============================
app.get("/attendance-records", (req, res) => {

  let sql = "SELECT rollno, name, ";

  sql += subjects
    .map(s => `CONCAT(${s}_present,'/30') AS ${s}`)
    .join(", ");

  sql += " FROM students_attendance ORDER BY rollno";

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(rows);
  });
});

// ===============================
// SERVER START
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});


// ========================
// attendece Ui
// ======================
app.get("/view-students-attendance", (req, res) => {

    const query = "SELECT * FROM students_attendance";

    db.query(query, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("Database error");
        } else {
            res.json(result);
        }
    });
});


app.post("/get-attendance-count", (req, res) => {
  let { subject, date } = req.body;

  subject = subject.trim().toLowerCase();

  if (!subjects.includes(subject)) {
    return res.status(400).json({ message: "Invalid subject" });
  }

  const columnDate = `${subject}_last_date`;

  const sql = `
    SELECT COUNT(*) AS count
    FROM students_attendance
    WHERE DATE(${columnDate}) = ?
  `;

  db.query(sql, [date], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "DB error" });
    }

    res.json({ count: result[0].count });
  });
});
