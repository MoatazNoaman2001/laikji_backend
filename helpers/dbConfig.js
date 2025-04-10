require('dotenv').config();
const mongoose = require('mongoose');

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
            else console.log('DB is connected!');
        },
    );
};
