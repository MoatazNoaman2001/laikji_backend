const wordFilterModel = require('../models/wordFilterModel');
var ObjectId = require('mongoose').Types.ObjectId;

const initFilter = () => {
    refreshFilters();
};

const refreshFilters = async (room_id = null) => {
    let filters = await wordFilterModel.find(
        room_id == null
            ? {}
            : {
                  roomRef: new ObjectId(room_id),
              },
    );

    if (room_id == null) {
        let s = new Set();
        global.filters.clear();
    } else {
        global.filters[room_id] = [];
    }

    filters.map((item) => {
        if (!global.filters[item.roomRef.toString()]) global.filters[item.roomRef.toString()] = [];

        global.filters[item.roomRef.toString()].push(item);
    });
};

const filterMsg = (msg, room_id) => {
    let words = msg.toString().split(' ');
    let new_words = [];
    if (global.filters[room_id.toString()]) {
        let founded = global.filters[room_id.toString()];
        if (founded.length > 0) {
            words.map((w) => {
                founded.map((f) => {
                    w = w.toString() == f.old_word.toString() ? f.new_word : w;
                });

                new_words.push(w);
            });
        }
    }
    new_words = new_words.length > 0 ? new_words : words;
    new_words = new_words.reduce((accumulator, currentValue) => accumulator + ' ' + currentValue);
    return new_words;
};

module.exports = {
    filterMsg,
    initFilter,
    refreshFilters,
};
