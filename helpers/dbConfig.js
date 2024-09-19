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
        },
        (er, db) => {
            if (er) console.log(er);
            else console.log('DB is connected!');
        },
    );
};
