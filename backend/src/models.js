const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/advising', {
  dialect: 'postgres',
  logging: false,
});

class User extends Model {}
User.init({
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('student', 'advisor'), allowNull: false },
}, { sequelize, modelName: 'User' });

class StudentProfile extends Model {}
StudentProfile.init({
  userId: { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  name: DataTypes.STRING,
  major: DataTypes.STRING,
}, { sequelize, modelName: 'StudentProfile' });

class AdvisorProfile extends Model {}
AdvisorProfile.init({
  userId: { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  name: DataTypes.STRING,
  department: DataTypes.STRING,
}, { sequelize, modelName: 'AdvisorProfile' });

class Availability extends Model {}
Availability.init({
  advisorId: { type: DataTypes.INTEGER, references: { model: AdvisorProfile, key: 'id' } },
  dayOfWeek: DataTypes.INTEGER, // 0=Sunday
  startHour: DataTypes.INTEGER, // 0-23
  endHour: DataTypes.INTEGER,
}, { sequelize, modelName: 'Availability' });

class Appointment extends Model {}
Appointment.init({
  studentId: { type: DataTypes.INTEGER, references: { model: StudentProfile, key: 'id' } },
  advisorId: { type: DataTypes.INTEGER, references: { model: AdvisorProfile, key: 'id' } },
  startTime: DataTypes.DATE,
  endTime: DataTypes.DATE,
  status: { type: DataTypes.ENUM('booked', 'completed', 'canceled'), defaultValue: 'booked' },
}, { sequelize, modelName: 'Appointment' });

class QueueItem extends Model {}
QueueItem.init({
  advisorId: { type: DataTypes.INTEGER, references: { model: AdvisorProfile, key: 'id' } },
  studentId: { type: DataTypes.INTEGER, references: { model: StudentProfile, key: 'id' } },
  status: { type: DataTypes.ENUM('waiting', 'serving', 'done'), defaultValue: 'waiting' },
}, { sequelize, modelName: 'QueueItem' });

class CaseNote extends Model {}
CaseNote.init({
  appointmentId: { type: DataTypes.INTEGER, references: { model: Appointment, key: 'id' } },
  content: DataTypes.TEXT,
}, { sequelize, modelName: 'CaseNote' });

class Referral extends Model {}
Referral.init({
  fromAdvisorId: { type: DataTypes.INTEGER, references: { model: AdvisorProfile, key: 'id' } },
  toAdvisorId: { type: DataTypes.INTEGER, references: { model: AdvisorProfile, key: 'id' } },
  studentId: { type: DataTypes.INTEGER, references: { model: StudentProfile, key: 'id' } },
  note: DataTypes.TEXT,
}, { sequelize, modelName: 'Referral' });

module.exports = { sequelize, User, StudentProfile, AdvisorProfile, Availability, Appointment, QueueItem, CaseNote, Referral };
