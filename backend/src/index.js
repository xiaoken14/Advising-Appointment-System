const express = require('express');
const cors = require('cors');
const { sequelize, User, StudentProfile, AdvisorProfile, Availability, Appointment, QueueItem, CaseNote, Referral } = require('./models');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const advisorRoutes = require('./routes/advisor');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/advisor', advisorRoutes);

const PORT = process.env.PORT || 4000;
sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
