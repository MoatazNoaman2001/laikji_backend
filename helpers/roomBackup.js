const cron = require('node-cron');
const roomModel = require('../models/roomModel');
const roomsBackup = require('../models/roomsBackup');

async function backupRooms() {
    try {
        console.log('Starting room backup...');

        const rooms = await roomModel.find({});
        rooms.forEach(async (room) => {
            const query = { roomRef: id };
            await roomsBackup.deleteOne(query);
            const backup = room.toObject();
            backup.roomRef = room._id;

            const newDoc = new roomsBackup(backup);
            await newDoc.save();
            // return res
            //     .status(200)
            //     .json({ message: 'Room backed up successfully', room: newDoc });;
        });
    } catch (err) {
        console.error('Error during room backup: ', err);
    }
}
module.exports = { backupRooms };
