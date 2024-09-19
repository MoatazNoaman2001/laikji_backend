const enums = require('../helpers/enums');
var ObjectId = require('mongoose').Types.ObjectId;

/**
 * 0    ban
 * 1    unban
 * 2    stop
 * 3    kick
 * 4    alert
 * 5    clear all
 * 6    public msg
 * 7    room settings
 * 8    admin logs
 * 9    entry logs
 * 10   mic control
 * 11   member manage
 * 12   admin manage
 * 13   super admin manage
 * 14   master manage
 * 15   filter
 */

const getPermissionOfType = (type, is_spy = false) => {
    if (is_spy) {
        return '11111111111111111';
    }

    var perm = '00000000000000000';

    switch (type.toString()) {
        case enums.userTypes.master.toString():
        case enums.userTypes.mastergirl.toString():
        case enums.userTypes.mastermain.toString():
        case enums.userTypes.chatmanager.toString():
        case enums.userTypes.root.toString():
            perm = '11111111111111111';
            break;

        case enums.userTypes.superadmin.toString():
            perm = '11111110011000000';
            break;

        case enums.userTypes.admin.toString():
            perm = '10111110001000000';
            break;

        case enums.userTypes.member.toString():
            perm = '00000000000000000';
            break;

        case enums.userTypes.guest.toString():
            perm = '00000000000000000';
            break;

        default:
            break;
    }

    return perm;
};

const getStrongOfType = (type, is_spy = false) => {
    var strong = 0;

    if (is_spy) {
        return 100000;
    }

    switch (type.toString()) {
        case enums.userTypes.mastermain.toString():
            strong = 90000;
            break;

        case enums.userTypes.chatmanager.toString():
            strong = 80000;
            break;

        case enums.userTypes.root.toString():
            strong = 70000;
            break;

        case enums.userTypes.master.toString():
        case enums.userTypes.mastergirl.toString():
            strong = 10000;
            break;

        case enums.userTypes.superadmin.toString():
            strong = 9900;
            break;

        case enums.userTypes.admin.toString():
            strong = 9800;
            break;

        case enums.userTypes.member.toString():
            strong = 9700;
            break;

        case enums.userTypes.guest.toString():
            strong = 0;
            break;

        default:
            break;
    }

    return strong;
};

const can = (index) => {
    return true;
};

module.exports = {
    getPermissionOfType,
    getStrongOfType,
    can,
};
