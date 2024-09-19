const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'rooms',
    },
    old_word: String,
    new_word: String,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('WordFilters', schema);
