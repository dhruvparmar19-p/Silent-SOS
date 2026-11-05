const { Schema, model } = require('mongoose');
module.exports = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, default: '' },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  contacts: [{ name: String, email: String, phone: String }]
}, { timestamps: true }));
