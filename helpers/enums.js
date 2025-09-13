var passcodes = {
    enterLock: '56dfg6;@4s;l%&$5dsaf',
};

var osTypes = {
    android: 'a',
    ios: 'i',
    desktop: 'd',
};

var groupsTypes = {
    country: 0,
    special: 1,
    gold: 2,
    meeting: 3,
    support: 4,
    learning: 5,
    all: 6,
};

var userTypes = {
    guest: 0,
    master: 1,
    mastergirl: 5,
    superadmin: 10,
    admin: 15,
    member: 20,
    mastermain: 100,
    chatmanager: 200,
    root: 300,
};

var fileTypes = {
    special: 0,
    vip: 5,
    king: 10,
    protected: 15,
    mastermain: 100,
    chatmanager: 200,
    root: 300,
};

var statusTypes = {
    empty: 0,
    away: 1,
    busy: 2,
    phone: 3,
    food: 4,
    zz: 5,
    car: 6,
    pray: 7,
    f1: 8,
    f2: 9,
    f3: 10,
    out: 11,
};

var banTypes = {
    room: 1,
    server: 2,
    ip: 3,
};

module.exports = {
    userTypes,
    osTypes,
    statusTypes,
    groupsTypes,
    fileTypes,
    passcodes,
    banTypes,
};
