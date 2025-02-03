const cron = require('node-cron');
const roomModel = require('../models/roomModel');
const roomsBackup = require('../models/roomsBackup');

async function backupRooms() {
    try {
        console.log('Starting room backup...');

        const rooms = await roomModel.find();
        await roomsBackup.deleteMany({});
        await roomsBackup.insertMany(rooms);

        console.log('Room backup completed successfully.');
    } catch (err) {
        console.error('Error during room backup: ', err);
    }
}
module.exports = { backupRooms };
