const Joi = require("joi");
const Event = require("../models/Event");
const User = require("../models/User");

const createSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(""),
  date: Joi.date().required(),
  location: Joi.string().allow(""),
  invites: Joi.array().items(Joi.string().email()).optional(),
});

exports.createEvent = async (req, res) => {
  const { error, value } = createSchema.validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, error: error.details[0].message });

  const { title, description, date, location } = value;
  const organizerId = req.user.id;

  const attendees = [];
  const invitees = [];
  const collaborators = [];
  const collaboratorInvitees = [];

  const event = await Event.create({
    title,
    description,
    date,
    location,
    organizer: organizerId,
    attendees,
    invitees,
    collaborators,
    collaboratorInvitees,
  });
  res.status(201).json({ success: true, data: event });
};

exports.listEvents = async (req, res) => {
  try {
    const {
      q,
      role = "all",
      page = 1,
      limit = 20,
      startDate,
      endDate,
      sortBy = "date",
      order = "asc",
    } = req.query;

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    // Base role filter
    let or = [
      { organizer: req.user.id },
      { "attendees.user": req.user.id },
      { "invitees.user": req.user.id },
      { "collaborators.user": req.user.id },
      { "collaboratorInvitees.user": req.user.id },
    ];

    // Apply specific role if provided
    if (role === "organizer") or = [{ organizer: req.user.id }];
    else if (role === "attendee") or = [{ "attendees.user": req.user.id }];
    else if (role === "invitee") or = [{ "invitees.user": req.user.id }];
    else if (role === "collaborator")
      or = [{ "collaborators.user": req.user.id }];
    else if (role === "collaborator-invitee")
      or = [{ "collaboratorInvitees.user": req.user.id }];

    const baseFilter = { $or: or };

    // Text search on title or description
    let searchFilter = {};
    if (q) {
      searchFilter = {
        $or: [
          { title: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
        ],
      };
    }

    // Date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    // Combine all filters using $and
    const filter = { $and: [baseFilter] };
    if (q) filter.$and.push(searchFilter);
    if (startDate || endDate) filter.$and.push(dateFilter);

    // Sorting
    const sort = {};
    sort[sortBy] = order === "asc" ? 1 : -1;

    // Query
    const events = await Event.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("organizer", "name email")
      .populate("attendees.user", "name email")
      .populate("invitees.user", "name email")
      .populate("collaborators.user", "name email")
      .populate("collaboratorInvitees.user", "name email");

    const total = await Event.countDocuments(filter);

    res.json({
      success: true,
      data: { events, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getEvent = async (req, res) => {
  const event = await Event.findById(req.params.id)
    .populate("organizer", "name email")
    .populate("attendees.user", "name email")
    .populate("invitees.user", "name email")
    .populate("collaborators.user", "name email")
    .populate("collaboratorInvitees.user", "name email");
  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });

  const isRelated =
    event.organizer._id.equals(req.user.id) ||
    event.attendees.some(
      (a) => a.user && a.user._id && a.user._id.equals(req.user.id)
    ) ||
    event.invitees.some(
      (a) => a.user && a.user._id && a.user._id.equals(req.user.id)
    ) ||
    event.collaborators.some(
      (a) => a.user && a.user._id && a.user._id.equals(req.user.id)
    ) ||
    event.collaboratorInvitees.some(
      (a) => a.user && a.user._id && a.user._id.equals(req.user.id)
    );
  if (!isRelated)
    return res.status(403).json({ success: false, error: "Forbidden" });

  res.json({ success: true, data: event });
};

exports.deleteEvent = async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });
  if (!event.organizer.equals(req.user.id))
    return res
      .status(403)
      .json({ success: false, error: "Only organizer can delete event" });
  await event.deleteOne();
  res.json({ success: true, data: "Event deleted" });
};

exports.inviteAttendee = async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails))
    return res
      .status(400)
      .json({ success: false, error: "emails must be array" });

  const event = await Event.findById(req.params.id);
  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });
  if (
    !event.organizer.equals(req.user.id) &&
    !event.collaborators.some((c) => c.user && c.user.equals(req.user.id))
  )
    return res.status(403).json({
      success: false,
      error: "Only organizer or collaborators can invite users to attend",
    });

  for (const email of emails) {
    const existing = event.invitees.find(
      (a) =>
        (a.email && a.email.toLowerCase() === email.toLowerCase()) ||
        (a.user && a.user.toString() === email)
    );
    if (existing) continue;
    const u = await User.findOne({ email });
    if (
      event.organizer.equals(u?._id) ||
      event.collaborators.some((c) => c.user && c.user.equals(u?._id))
    )
      continue;
    event.invitees.push({
      user: u ? u._id : undefined,
      email,
      role: "invitee",
      invitedAt: new Date(),
    });
  }

  await event.save();
  res.json({ success: true, data: event });
};

exports.inviteCollaborator = async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails))
    return res
      .status(400)
      .json({ success: false, error: "emails must be array" });

  const event = await Event.findById(req.params.id);
  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });
  if (!event.organizer.equals(req.user.id))
    return res.status(403).json({
      success: false,
      error: "Only organizer can invite users to collaborate",
    });

  for (const email of emails) {
    const existing = event.collaborators.find(
      (a) =>
        (a.email && a.email.toLowerCase() === email.toLowerCase()) ||
        (a.user && a.user.toString() === email)
    );
    if (existing) continue;
    const u = await User.findOne({ email });
    event.collaboratorInvitees.push({
      user: u ? u._id : undefined,
      email,
      role: "collaborator-invitee",
      invitedAt: new Date(),
    });
  }

  await event.save();
  res.json({ success: true, data: event });
};

exports.respondAttendee = async (req, res) => {
  const { status } = req.body;
  if (!["Going", "Maybe", "Not Going"].includes(status))
    return res.status(400).json({ success: false, error: "Invalid status" });

  const event = await Event.findById(req.params.id);
  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });

  let inviteeIndex = event.invitees.findIndex(
    (a) =>
      (a.user && a.user.toString() === req.user.id) ||
      (!a.user && a.email && a.email.toLowerCase() === req.user.email)
  );

  if (inviteeIndex === -1) {
    return res
      .status(403)
      .json({ success: false, error: "You are not invited to this event" });
  }

  let attendeeIndex = event.attendees.findIndex(
    (a) =>
      (a.user && a.user.toString() === req.user.id) ||
      (!a.user && a.email && a.email.toLowerCase() === req.user.email)
  );

  if (attendeeIndex === -1) {
    if (status !== "Not Going") {
      event.attendees.push({
        user: req.user.id,
        role: "attendee",
        status,
        invitedAt: new Date(),
        respondedAt: new Date(),
      });
    }
  } else {
    if (status === "Not Going") {
      event.attendees.splice(attendeeIndex, 1);
    } else {
      event.attendees[attendeeIndex].status = status;
      event.attendees[attendeeIndex].respondedAt = new Date();
    }
  }
  event.invitees[inviteeIndex].status = status;
  event.invitees[inviteeIndex].respondedAt = new Date();

  await event.save();
  res.json({ success: true, data: "Response recorded" });
};

exports.respondCollaborator = async (req, res) => {
  const { status } = req.body;
  if (!["Yes", "No"].includes(status))
    return res.status(400).json({ success: false, error: "Invalid status" });

  const event = await Event.findById(req.params.id);
  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });

  let collaboratorInviteeIndex = event.collaboratorInvitees.findIndex(
    (a) =>
      (a.user && a.user.toString() === req.user.id) ||
      (!a.user && a.email && a.email.toLowerCase() === req.user.email)
  );

  let collaboratorIndex = event.collaborators.findIndex(
    (a) =>
      (a.user && a.user.toString() === req.user.id) ||
      (!a.user && a.email && a.email.toLowerCase() === req.user.email)
  );

  if (collaboratorInviteeIndex === -1 && collaboratorIndex === -1)
    return res.status(403).json({
      success: false,
      error: "You are not invited to collaborate on this event",
    });

  if (collaboratorIndex === -1) {
    if (status === "Yes") {
      event.collaborators.push({
        user: req.user.id,
        role: "collaborator",
        status,
        invitedAt: new Date(),
        respondedAt: new Date(),
      });
    }
  } else {
    if (status === "No") {
      event.collaborators.splice(collaboratorIndex, 1);
    } else {
      event.collaborators[collaboratorIndex].status = status;
      event.collaborators[collaboratorIndex].respondedAt = new Date();
    }
  }

  event.collaboratorInvitees.splice(collaboratorInviteeIndex, 1);

  await event.save();
  res.json({ success: true, data: "Collaboration response recorded" });
};

exports.getAttendees = async (req, res) => {
  const event = await Event.findById(req.params.id).populate(
    "attendees.user",
    "name email"
  );
  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });
  if (
    !event.organizer.equals(req.user.id) &&
    !event.collaborators.some((c) => c.user && c.user.equals(req.user.id))
  )
    return res
      .status(403)
      .json({
        success: false,
        error: "Only organizer or collaborators can view attendees",
      });
  res.json({ success: true, data: event.attendees });
};

exports.getCollaborators = async (req, res) => {
  const event = await Event.findById(req.params.id).populate(
    "collaborators.user",
    "name email"
  );

  if (!event)
    return res.status(404).json({ success: false, error: "Event not found" });

  // Only organizer can view collaborators
  if (!event.organizer.equals(req.user.id))
    return res
      .status(403)
      .json({ success: false, error: "Only organizer can view collaborators" });

  res.json({ success: true, data: event.collaborators });
};
