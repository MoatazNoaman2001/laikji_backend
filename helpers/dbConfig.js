require('dotenv').config();
const mongoose = require('mongoose');
const cron = require('node-cron');
const { backupRooms } = require('./roomBackup');

module.exports = () => {
    var dbCS = process.env.DB;
    mongoose.connect(
        dbCS,
        {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            // bufferCommands: false, // Disable buffering
            serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
        },
        (er, db) => {
            if (er) console.log(`error from db ${er}`);
            else {
                console.log('DB is connected!');
                cron.schedule(
                    '19 12 * * *',
                    () => {
                        console.log('Running rooms backup...');
                        backupRooms();
                    },
                    {
                        timezone: 'Asia/Riyadh',
                    },
                );
            }
        },
    );
};
