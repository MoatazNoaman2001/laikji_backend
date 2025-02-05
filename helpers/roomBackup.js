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

            await roomsBackup.deleteOne(query);

            const backup = room.toObject();
            backup.roomRef = roomId;
            const backupDate = new Date().toISOString();

            await roomModel.findByIdAndUpdate(roomId, { latestBackup: backupDate });
            const newDoc = new roomsBackup(backup);
            await newDoc.save();
        }

        console.log('Room backup completed successfully.');
    } catch (err) {
        console.error('Error during room backup: ', err);
    }
}

module.exports = { backupRooms };
