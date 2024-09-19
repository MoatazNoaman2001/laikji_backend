const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = Schema({
    key: String,
    val: String,
});

module.exports = mongoose.model('Settings', schema);
