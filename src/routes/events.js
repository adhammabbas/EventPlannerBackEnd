const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/eventController');

router.use(auth);

router.post('/', ctrl.createEvent);
router.get('/', ctrl.listEvents);
router.get('/:id', ctrl.getEvent);
router.delete('/:id', ctrl.deleteEvent);
router.post('/:id/invite/attendee', ctrl.inviteAttendee);
router.post('/:id/invite/collaborator', ctrl.inviteCollaborator);
router.put('/:id/respond/attendee', ctrl.respondAttendee);
router.put('/:id/respond/collaborator', ctrl.respondCollaborator);
router.get('/:id/attendees', ctrl.getAttendees);
router.get('/:id/collaborators', ctrl.getCollaborators);

module.exports = router;
