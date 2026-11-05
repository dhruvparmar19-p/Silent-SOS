const { Schema, model } = require('mongoose');
module.exports = model('Alert', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ['sent', 'acknowledged', 'resolved'], default: 'sent' },
  location: { lat: Number, lng: Number, accuracy: Number, at: Date },
  path: [{ lat: Number, lng: Number, at: Date }],
  log: [{ event: String, by: String, at: { type: Date, default: Date.now } }],
  deliveryMs: Number,
  acknowledgedAt: Date,
  resolvedAt: Date,
  responseMs: Number
}, { timestamps: true }));
