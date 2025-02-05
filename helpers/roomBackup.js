const cron = require('node-cron');
const roomModel = require('../models/roomModel');
const roomsBackup = require('../models/roomsBackup');

async function backupRooms() {
    try {
        console.log('Starting room backup...');

        const rooms = await roomModel.find({});
        for (const room of rooms) {
            const roomId = room._id;
            const query = { roomRef: roomId };

            // Delete old backup if exists
            await roomsBackup.deleteOne(query);

            // Prepare new backup data
            const backup = room.toObject();
            backup.roomRef = roomId;
            const backupDate = new Date().toISOString();

            // Update the original room's latest backup date
            await roomModel.findByIdAndUpdate(roomId, { latestBackup: backupDate });

            // Save the new backup document
            const newDoc = new roomsBackup(backup);
            await newDoc.save();
        }

        console.log('Room backup completed successfully.');
    } catch (err) {
        console.error('Error during room backup: ', err);
    }
}

module.exports = { backupRooms };
