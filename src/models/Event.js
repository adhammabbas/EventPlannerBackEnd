const mongoose = require("mongoose");

const AttendeeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  email: { type: String },
  role: {
    type: String,
    enum: ["organizer", "attendee", "invitee", "collaborator","collaborator-invitee"],
    default: "attendee",
  },
  status: {
    type: String,
    enum: ["Going", "Maybe", "Not Going", "Yes", "No", null],
    default: null,
  },
  invitedAt: { type: Date },
  respondedAt: { type: Date },
});

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  date: { type: Date, required: true },
  location: { type: String, default: "" },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  invitees: [AttendeeSchema],
  attendees: [AttendeeSchema],
  collaboratorInvitees: [AttendeeSchema],
  collaborators: [AttendeeSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

EventSchema.index({ title: "text", description: "text" });
EventSchema.index({ date: 1 });

EventSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Event", EventSchema);
