const express = require("express");
const app = express();
const session = require("express-session");
const path = require("path");
const port = 4500;
const { v4: uuidv4 } = require('uuid');
const methodOverride = require("method-override");
const { faker } = require('@faker-js/faker');
const mysql = require('mysql2/promise');


app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method")); 
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));



const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'railway',
  password: '12345'
});


const fetchUserId = async (req, res, next) => {
  const userId = req.session && req.session.user_id;

  if (userId) {
    const q = 'SELECT * FROM users WHERE user_id = ?';
    try {
      const [results, fields] = await pool.query(q, [userId]);

      if (results.length > 0) {
        req.user = results[0]; 
      }
    } catch (err) {
      console.error(err);
      res.send("Some error occurred");
      return;
    }
  }

  next();
};




app.use(fetchUserId);


app.get("/",(req,res)=>{
res.render("login.ejs");
});
app.get("/contactus",(req,res)=>{
res.render("contactus.ejs");
});

app.get("/aboutus",(req,res)=>{
  res.render("aboutus.ejs");
  });

app.get("/new",(req,res)=>{
res.render("new.ejs")
});


app.get("/bookings", async (req, res) => {
  try {
    const userId = req.session.user_id;

    if (!userId) {
      return res.status(404).json({ error: "User not found" });
    }

    const q = `
      SELECT b.booking_id, t.train_name, t.source_station, t.destination_station, b.seat_count, b.booking_time
      FROM bookings b
      JOIN trains t ON b.train_id = t.train_id
      WHERE b.user_id = ?
    `;

    const [results, fields] = await pool.query(q, [userId]);

    console.log(results); 

    const bookings = results;

    res.render("booking.ejs", { bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Some error occurred" });
  }
});

app.post("/cancelBooking", async (req, res) => {
  const { booking_id } = req.body;

  


  const deleteQuery = 'DELETE FROM bookings WHERE booking_id = ?';
  await pool.query(deleteQuery, [booking_id]);

  console.log(`Booking with ID ${booking_id} canceled successfully`);
  

  res.redirect("/bookings");
});


app.post("/new", async (req, res) => {
  let id = uuidv4();
  let {username, password} = req.body;
  let q = 'INSERT INTO users (user_id, username, password) VALUES (?, ?, ?)';
  let values = [id, username, password];

  try {
    const [rows, fields] = await pool.query(q, values);
    console.log("Added new user");
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Some error occurred");
  }
});



app.post("/", async (req, res) => {
  const { username, password } = req.body;
  const q = `SELECT * FROM users WHERE username = ? AND password = ?`;

  try {
    const [results, fields] = await pool.query(q, [username, password]);

    if (results.length > 0) {
      const user = results[0];
      req.session.user_id = user.user_id;
      console.log(req.session.user_id);
      res.render("search", { user });
    } else {
      
      const error = "Incorrect username or password";
      res.render("login", { error });
    }
  } catch (err) {
    console.log(err);
    res.send("Some error occurred");
  }
});

app.get("/confirmation", (req, res) => {
  res.render("confirmation.ejs");
});

app.post("/search", async (req, res) => {
  const { source, destination } = req.body;
  console.log(req.body);

  
  const user_id = req.session ? req.session.user_id : null;
  console.log(user_id);
  const q = `SELECT * FROM trains WHERE source_station = ? AND destination_station = ?`;

  try {
    const [results, fields] = await pool.query(q, [source, destination]);
    const trains = results;

    
    res.render("search-results.ejs", { trains, user_id });
  } catch (err) {
    console.error(err);
    res.send("Some error occurred");
  }
});

app.post("/bookings/:id", async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { train_id, seat_count } = req.body;
    const booking_time = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (!userId) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the user has already booked the same train
    const existingBookingQuery = 'SELECT * FROM bookings WHERE user_id = ? AND train_id = ?';
    const [existingBookingResults, existingBookingFields] = await pool.query(existingBookingQuery, [userId, train_id]);

    if (existingBookingResults.length > 0) {
      // Update the existing booking
      const updateQuery = 'UPDATE bookings SET seat_count = ? WHERE booking_id = ?';
      const updateValues = [existingBookingResults[0].seat_count + seat_count, existingBookingResults[0].booking_id];
      await pool.query(updateQuery, updateValues);
      console.log("Booking updated successfully");
    } else {
      // Create a new booking
      const booking_id = uuidv4();
      const insertQuery = 'INSERT INTO bookings (booking_id, user_id, train_id, seat_count, booking_time) VALUES (?, ?, ?, ?, ?)';
      const insertValues = [booking_id, userId, train_id, seat_count, booking_time];
      await pool.query(insertQuery, insertValues);
      console.log("New booking created successfully");
    }

    res.render("confirmation.ejs");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Some error occurred" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
