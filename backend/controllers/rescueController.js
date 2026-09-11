const RescueRequest = require('../models/RescueRequest');
const Animal = require('../models/Animal');

// @desc    Create a new rescue request
// @route   POST /api/rescues
// @access  Private
exports.createRescueRequest = async (req, res) => {
    try {
        const { description, urgency, location, media } = req.body;

        const request = await RescueRequest.create({
            reporter: req.user.id,
            description,
            urgency,
            location: {
                type: 'Point',
                coordinates: location.coordinates // [lng, lat]
            },
            media
        });
        
        const populatedRequest = await RescueRequest.findById(request._id).populate('reporter', 'name');
        
        // Emit event to all connected clients
        req.io.emit('new_rescue', populatedRequest);

        res.status(201).json(populatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all rescue requests (can filter by status/urgency)
// @route   GET /api/rescues
// @access  Public or Private depending on logic
exports.getRescueRequests = async (req, res) => {
    try {
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.urgency) query.urgency = req.query.urgency;

        const requests = await RescueRequest.find(query)
            .populate('reporter', 'name email phone')
            .populate('assignedTo', 'name phone')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update rescue request status (assign, resolve)
// @route   PUT /api/rescues/:id
// @access  Private (NGO, Volunteer, Admin)
exports.updateRescueRequest = async (req, res) => {
    try {
        const { status, assignedTo, animalRef } = req.body;
        const request = await RescueRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Allow updates
        if (status) request.status = status;
        if (assignedTo) request.assignedTo = assignedTo;
        if (animalRef) request.animalRef = animalRef;

        const updatedRequest = await request.save();
        res.json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
