const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { getNowDateTime } = require('../helpers/tools');

const schema = Schema({
    name: String,
    password: String,
    is_visible: {
        type: Boolean,
        default: false,
    },
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('Spys', schema);
