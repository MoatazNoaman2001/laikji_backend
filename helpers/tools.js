const settingModel = require('../models/settingModel');
const groupModel = require('../models/groupModel');
const enums = require('./enums');
const moment = require('moment/moment');

function simg(img) {
    return img ? process.env.mediaUrl + img : null;
}

function hexToXRgb(color) {
    const r = color ? parseInt(color.substr(1, 2), 16) : 0;
    const g = color ? parseInt(color.substr(3, 2), 16) : 0;
    const b = color ? parseInt(color.substr(5, 2), 16) : 0;
    return `${r}|${g}|${b}`;
}

async function getSettings() {
    var grbs = await groupModel.find();
    const all = await settingModel.find({});
    const response = {};

    all.forEach((item) => {
        response[item.key] = item.val;
    });
    
    // console groups commented by zk
    // console.log(grbs);
    // console response commented by zk
    // console.log(response);

    if (grbs.length !== 0){
    response['special_icon'] = simg(
        grbs.filter((g) => g.type == enums.groupsTypes.special)[0].icon,
    );
    response['gold_icon'] = simg(grbs.filter((g) => g.type == enums.groupsTypes.gold)[0].icon);
    response['learning_icon'] = simg(
        grbs.filter((g) => g.type == enums.groupsTypes.learning)[0].icon,
    );
    response['meeting_icon'] = simg(
        grbs.filter((g) => g.type == enums.groupsTypes.meeting)[0].icon,
    );
    response['support_icon'] = simg(
        grbs.filter((g) => g.type == enums.groupsTypes.support)[0].icon,
    );
}

    return response;
}

const generateRoomSerial = async () => {
    let serial = '0';
    const settings = await getSettings();
    if (settings && settings.room_serial) {
        serial = (parseInt(settings.room_serial.toString()) + 1).toString();
    } else {
        serial = '1000';
    }

    await settingModel.findOneAndUpdate(
        {
            key: 'room_serial',
        },
        {
            key: 'room_serial',
            val: serial,
        },
        {
            upsert: true,
        },
    );

    return serial;
};

function intToString(value) {
    if (value < 1000) return value.toString();
    var suffixes = ['', 'k', 'm', 'b', 't'];
    var suffixNum = Math.floor(('' + value).length / 3);
    var shortValue = parseFloat(
        (suffixNum != 0 ? value / Math.pow(1000, suffixNum) : value).toPrecision(2),
    );
    if (shortValue % 1 != 0) {
        shortValue = shortValue.toFixed(1);
    }
    return shortValue + suffixes[suffixNum];
}

const getNowDateTime = (in_timestamp = false) => {
    return in_timestamp ? moment().utc().toDate().getTime() : moment().utc().toDate();
};

const millisecondsToDays = (ms) => {
    if (ms <= 0) return 0;
    return ms / 1000 / 60 / 60 / 24;
};

module.exports = {
    getSettings,
    hexToXRgb,
    intToString,
    simg,
    generateRoomSerial,
    getNowDateTime,
    millisecondsToDays,
};
