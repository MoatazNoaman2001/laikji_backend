const cron = require('node-cron');
const roomModel = require('../models/roomModel');
const roomsBackup = require('../models/roomsBackup');

async function backupRooms() {
    try {
        console.log('Starting room backup...');

        const rooms = await roomModel.find({});
        rooms.forEach(async (room) => {
            const query = { roomRef: room._id };
            await roomsBackup.deleteOne(query);
            const backup = { ...room, roomRef: room._id };
            await roomsBackup.insertOne(backup);
        });

        console.log('Room backup completed successfully.');
    } catch (err) {
        console.error('Error during room backup: ', err);
    }
}
module.exports = { backupRooms };
