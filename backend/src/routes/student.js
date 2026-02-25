const express = require('express');
const router = express.Router();
const { StudentProfile, AdvisorProfile, Availability, Appointment, QueueItem, CaseNote, Referral, User } = require('../models');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT and attach user
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Get student profile
router.get('/profile', auth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
  const profile = await StudentProfile.findOne({ where: { userId: req.user.id } });
  res.json(profile);
});

// Book appointment with advisor (expects advisorId, startTime, endTime)
router.post('/appointments', auth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
  const { advisorId, startTime, endTime } = req.body;
  const studentProfile = await StudentProfile.findOne({ where: { userId: req.user.id } });
  if (!studentProfile) return res.status(400).json({ message: 'Student profile missing' });
  const appointment = await Appointment.create({
    studentId: studentProfile.id,
    advisorId,
    startTime,
    endTime,
    status: 'booked',
  });
  res.json(appointment);
});

// View student's appointments
router.get('/appointments', auth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
  const studentProfile = await StudentProfile.findOne({ where: { userId: req.user.id } });
  const appointments = await Appointment.findAll({ where: { studentId: studentProfile.id } });
  res.json(appointments);
});

// Join walk‑in queue for an advisor
router.post('/queue/join', auth, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
  const { advisorId } = req.body;
  const studentProfile = await StudentProfile.findOne({ where: { userId: req.user.id } });
  const item = await QueueItem.create({ advisorId, studentId: studentProfile.id, status: 'waiting' });
  res.json(item);
});

module.exports = router;
