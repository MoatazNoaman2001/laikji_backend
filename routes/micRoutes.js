const express = require('express');
const router = express.Router();
const roomModel = require('../models/roomModel');
const { getRoomData } = require('../helpers/mediasoupHelpers');

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

module.exports = router;
