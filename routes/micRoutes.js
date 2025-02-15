const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const roomModel = require('../models/roomModel');
const { getRoomData } = require('../helpers/mediasoupHelpers');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Save files in the 'uploads' directory
    },
    filename: function (req, file, cb) {
        // Create a unique filename: userId + roomId + timestamp + file extension
        const userId = req.body.userId; // Get userId from the request body
        const roomId = req.body.roomId; // Get roomId from the request body
        const ext = path.extname(file.originalname); // Get file extension
        const filename = `${userId}_${roomId}_${Date.now()}${ext}`; // Construct filename
        cb(null, filename);
    },
});

const upload = multer({ storage: storage });

// Create the 'uploads' directory if it doesn't exist
const fs = require('fs');
const dir = './uploads';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

// Get room state
router.get('/state', async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const room = await roomModel.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const roomInfo = getRoomData(roomId);
        res.json({
            speakers: Array.from(roomInfo.speakers),
            listeners: Array.from(roomInfo.listeners),
            holdMic: Array.from(roomInfo.holdMic),
            openedTime: room.opened_time,
            maxSpeakers: room.max_speakers_count,
            maxSpeakerTime: room.max_speaker_time,
            updateTime: room.update_time,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Release speaking
router.post('/release-speak', async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const userId = req.body.userId;

        const roomInfo = getRoomData(roomId);
        roomInfo.speakers.delete(userId);
        io.to(roomId).emit('update-speakers', Array.from(roomInfo.speakers));

        res.json({ message: 'Speaking released' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Request to speak
router.post('/request-speak', async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const userId = req.body.userId;

        const room = await roomModel.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const roomInfo = getRoomData(roomId);

        if (roomInfo.speakers.size < room.max_speakers_count || room.opened_time) {
            roomInfo.speakers.add(userId);
            global.io.to(roomId).emit('update-speakers', Array.from(roomInfo.speakers));
            res.json({ message: 'Request to speak accepted' });
        } else {
            res.status(400).json({ message: 'Max speakers limit reached' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Upload audio file
router.post('/upload-audio', upload.single('audio'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Access metadata from the request body
        const { userId, roomId, description } = req.body;

        // Respond with file and metadata details
        res.json({
            message: 'File uploaded successfully',
            file: req.file,
            metadata: {
                userId,
                roomId,
                description,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
