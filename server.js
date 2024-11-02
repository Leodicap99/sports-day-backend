const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());
const cors = require("cors");
const CryptoJS = require("crypto-js"); 
app.use(cors());
let users = [];
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME = 5*60*1000;
app.post("/api/users", (req, res) => {
  const { userId,password } = req.body;
  if (!userId || userId.length < 7) {
    return res
      .status(400)
      .json({ error: "UserId must be atleast 7 characters long" });
  }
  const normalizedUserId = userId.toLowerCase();
  const userExists = users.find(
    (user) => user.userId.toLowerCase() === normalizedUserId
  );
  if (userExists) {
    return res.status(400).json({ error: "UserId already exists" });
  }
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }
   const encryptedPassword = CryptoJS.AES.encrypt(
     password,
     "secret-key"
   ).toString();
   users.push({ ...req.body, password: encryptedPassword });
  res.status(201).json({ message: "User created successfully" });
});
app.post("/api/login", (req, res) => {
  const { userId, password } = req.body;
  const user = users.find(
    (user) => user.userId.toLowerCase() === userId.toLowerCase()
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.lockUntil) {
    user.lockUntil = null;
  }
  if (user.lockUntil && user.lockUntil > Date.now()) {
    return res.status(403).json({
      error:
        "Your account is locked due to multiple failed login attempts. Please try again later.",
    });
  }
  const decryptedBytes = CryptoJS.AES.decrypt(user.password, "secret-key");
  const decryptedPassword = decryptedBytes.toString(CryptoJS.enc.Utf8);
  if (decryptedPassword !== password) {
    user.failedLoginAttempts = user.failedLoginAttempts
      ? user.failedLoginAttempts + 1
      : 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = Date.now() + LOCK_TIME; 
      return res.status(403).json({
        error:
          "Your account is locked due to multiple failed login attempts. Please try again later.",
      });
    }

    return res.status(401).json({ error: "Invalid credentials"});
  }
  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  res
    .status(200)
    .json({
      message: "Login successful",
      data: { userId: user.userId, selectedEvents: user.selectedEvents ?? [] },
    });
});
app.post('/api/save-selected-events',(req,res)=>{
    const {userId, selectedEvents} = req.body;
    const user = users.find(user => user.userId.toLowerCase()===userId.toLowerCase());
    if(!Array.isArray(selectedEvents) || (selectedEvents.length>3)){
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Selected events should be an array with a maximum of 3 events",
        });
    }
    if(user){
        user.selectedEvents = selectedEvents;
        const {password,...userWithoutPassword} = user
        return res
          .status(200)
          .json({
            message: "Selected events saved successfully",
            data: userWithoutPassword,
          });
    } else {
        res.status(404).json({error: 'User not found'});
    }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));