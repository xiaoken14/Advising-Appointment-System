const express = require('express');
const router = express.Router();
const { AdvisorProfile, Availability, Appointment, QueueItem, CaseNote, Referral, StudentProfile } = require('../models');
const jwt = require('jsonwebtoken');

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

// Get advisor profile
router.get('/profile', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const profile = await AdvisorProfile.findOne({ where: { userId: req.user.id } });
  res.json(profile);
});

// Set availability (array of {dayOfWeek,startHour,endHour})
router.post('/availability', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const { slots } = req.body; // expect array
  const advisor = await AdvisorProfile.findOne({ where: { userId: req.user.id } });
  if (!advisor) return res.status(400).json({ message: 'Advisor profile missing' });
  // Remove existing
  await Availability.destroy({ where: { advisorId: advisor.id } });
  const created = await Availability.bulkCreate(slots.map(s => ({ advisorId: advisor.id, ...s })));
  res.json(created);
});

// View today's appointments
router.get('/appointments/today', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const advisor = await AdvisorProfile.findOne({ where: { userId: req.user.id } });
  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(end.getDate()+1);
  const appointments = await Appointment.findAll({ where: { advisorId: advisor.id, startTime: { [require('sequelize').Op.between]: [start, end] } } });
  res.json(appointments);
});

// Mark appointment completed/incomplete
router.patch('/appointments/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const { status } = req.body; // booked/completed/canceled
  const appointment = await Appointment.findByPk(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'Not found' });
  appointment.status = status;
  await appointment.save();
  res.json(appointment);
});

// View walk‑in queue
router.get('/queue', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const advisor = await AdvisorProfile.findOne({ where: { userId: req.user.id } });
  const queue = await QueueItem.findAll({ where: { advisorId: advisor.id } });
  res.json(queue);
});

// Update queue item status
router.patch('/queue/:id', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const { status } = req.body; // waiting/serving/done
  const item = await QueueItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  item.status = status;
  await item.save();
  res.json(item);
});

// Add case note after appointment
router.post('/appointments/:id/casenote', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const { content } = req.body;
  const note = await CaseNote.create({ appointmentId: req.params.id, content });
  res.json(note);
});

// Referral to another advisor
router.post('/referral', auth, async (req, res) => {
  if (req.user.role !== 'advisor') return res.status(403).json({ message: 'Forbidden' });
  const { toAdvisorId, studentId, note } = req.body;
  const fromAdvisor = await AdvisorProfile.findOne({ where: { userId: req.user.id } });
  const referral = await Referral.create({ fromAdvisorId: fromAdvisor.id, toAdvisorId, studentId, note });
  res.json(referral);
});

module.exports = router;
