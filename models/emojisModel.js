const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    path: String,
    order: Number,
    key: String,
    category: String,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('emojis', schema);
