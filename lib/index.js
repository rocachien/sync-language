/**
 * @copyright 2019 @ DigiNet
 * @author rocachien
 * @create 2019/07/27 20:37
 * @update 2019/07/27 20:37
 */
"use strict";

const fs = require('fs');
const crypto = require('crypto');
const sync = {};
const conf = {
    syncData: [],
    fileDB: 'sync/R0002.json',
    fileLG: 'public/localize.js',

    inputPrefix:  'LANG_',
    outputPrefix: 'N/A',
    module:       'MD001',
    productID:    'N/A',
    resourceID:   [],
    syncToLocal:  'N/A',

    user:               "N/A",
    password:           "N/A",
    server:             "N/A",
    database:           "N/A",

    secret:             "N/A",
    connection:         "N/A",

    syncSQL:            "N/A",
    sqlAddTemplate:     "N/A",
    sqlUpdateTemplate:  "N/A",
};
const sortByKey = (array, key) => {
    return array.sort(function(a, b) {
        const x = a[key];
        const y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
};
const escape = (str) => {
    str = String(str);
    str= str.split(`'`).join(`''`);
    return str;
};
const syncTime = () => {
    const date = new Date();
    return date.getTime();
};
const decrypt = (text, secret) => {
    let decipher = crypto.createDecipher('aes-128-cbc', secret);
    let dec = decipher.update(text,'hex','utf8');

    dec += decipher.final('utf8');
    return dec;
};

const encrypt = (text, secret) => {
    let cipher = crypto.createCipher('aes-128-cbc', secret);
    let enc = cipher.update(text,'utf8', 'hex');

    enc += cipher.final('hex');
    return enc;
};

sync.encrypt = (text, secret) => {
    return encrypt(text, secret);
};

sync.request = async () => {
    console.log('===== sync.request =====');

    return new Promise(async (resolve, reject) => {
        const sql = require('mssql');
        const config = {
            user:       conf.user,
            password:   conf.password,
            server:     conf.server,
            database:   conf.database
        };

        sync.pool = {};
        let pool = sync.pool[config.database] ? sync.pool[config.database] : null;

        try {
            if (!pool || !pool.connected) {
                pool = new sql.ConnectionPool(config);

                pool.connect(err => {
                    if (err) {
                        console.warn('=== connect => err: ', JSON.stringify(err));
                        return reject({code: 'SYS050', message: 'Connection to MSSQL fail.', data: null});
                    }

                    try {
                        const result = new sql.Request(pool);
                        resolve(result);
                    } catch (err) {
                        console.warn('=== Request => err: ', JSON.stringify(err));
                        const error = err.originalError && err.originalError.info && err.originalError.info.message ? err.originalError.info.message : JSON.stringify(err);
                        return reject({code: 'SYS051', message: 'The request to MSSQL fail. ' + error, data: null});
                    }
                });
            }
        } catch (err) {
            console.warn('=== mssql => err: ', JSON.stringify(err));
            return reject({code: 'SYS050', message: 'Connection to MSSQL fail.', data: null});
        }
    });
};
sync.query = async (sql) => {
    console.log('===== sync.query =====');
    let request;

    try {
        request = await sync.request();
    } catch (err) {
        console.warn('=== query => err: ', JSON.stringify(err));
        return err;
    }

    if (!sql) {
        return {code: 'SYS052', message: 'The query to MSSQL is required.', data: null};
    }

    try {
        return await request.query(sql);
    } catch (err) {
        console.warn('=== query => err: ', JSON.stringify(err));
        const error = err.originalError && err.originalError.info && err.originalError.info.message ? err.originalError.info.message : JSON.stringify(err);
        return {code: 'SYS051', message: 'The query to MSSQL fail. ' + error, data: null};
    }
};
sync.read = async (file) => {
    console.log('===== sync.read => file:', file);

    return new Promise(async (resolve, reject) => {
        fs.readFile(file, 'utf8', (error, data) => {
            if (error) {
                console.warn('=== readFile => err: ', JSON.stringify(error));
                return reject(error);
            }
            return resolve(data);
        });
    });
};
sync.write = async (file, data) => {
    console.log('===== sync.write => file:', file);

    return new Promise(async (resolve, reject) => {
        fs.writeFile(file, data, 'utf8', (error) => {
            if (error) {
                console.warn('=== writeFile => err: ', JSON.stringify(error));
                return reject(error);
            }
            return resolve({'success': true});
        });
    });
};
sync.parseContent = (data) => {
    console.log('===== sync.parseContent =====');

    let str = JSON.stringify(data);

    // console.log('===== str: ', str);
    str = str.replace("[{", "[{\n\t");
    str = str.replace(/ *","*/g, "\",\n\t\"");
    str = str.replace(/ *,"S*/g, ",\n\t\"S");
    str = str.replace(/ *"},{"*/g, "\"\n\t},{\n\t\"");
    str = str.replace("}]", "\n}]");

    return str;
};
sync.updateFromLocal = async () => {
    console.log('===== sync.updateFromLocal =====');

    let isUpdate = false;

    try {
        let lcData = await sync.read(conf.fileLG);

        if (lcData) {
            lcData = lcData.replace("var localize = ", "");
            lcData = lcData.replace(";", "");
            lcData = lcData.replace(/\\/g, "");
            const prefix = conf.inputPrefix;

            const localize = JSON.parse(lcData);

            if (localize && localize.en && localize.vi) {
                // console.log('== localize:', localize.vi);

                Object.keys(localize.vi).forEach(function (key) {
                    const o = {};
                    const viLang = localize.vi[key] ? localize.vi[key] : null;
                    const enLang = localize.en[key] ? localize.en[key] : null;
                    const originKey = prefix ? key.replace(prefix, '') : key;

                    o.ResourceID = originKey;
                    o.LocalEnglish = enLang ? enLang : viLang;
                    o.LocalVietNamese = viLang ? viLang : enLang;
                    o.LocalTime = syncTime();

                    conf.resourceID.push(originKey);

                    if (sync.checkLocalChange(o)) {
                        isUpdate = true;
                    }
                });
            }
        }
    } catch (e) {
        console.log('===== e: ', e);
    }

    if (isUpdate) {
        await sync.write(conf.fileDB, sync.parseContent(conf.syncData));
    }
};
sync.updateFromServer = async () => {
    console.log('===== sync.updateFromServer =====');

    let isUpdate = false;
    let resourceIDs = conf.resourceID;
    resourceIDs = "'" + resourceIDs.join("', '") + "'";
    const syncSQL = conf.syncSQL.replace('{ResourceID}', resourceIDs);
    const result = await sync.query(syncSQL);
    // console.log('===== result: ', syncSQL, result);

    if (result && result.recordset) {
        for (let i = 0; i < result.recordset.length; i++) {
            const l = result.recordset[i];
            const o = {};
            // console.log('===== lang: ', l);

            const viLang = l.VietNamese ? l.VietNamese : null;
            const enLang = l.English ? l.English : null;

            o.ResourceID = l.ResourceID;
            o.ServerEnglish = enLang ? enLang : viLang;
            o.ServerVietNamese = viLang ? viLang : enLang;
            o.ServerTime = syncTime();

            if (sync.checkServerChange(o)) {
                isUpdate = true;
            }
        }
    }

    if (isUpdate) {
        await sync.write(conf.fileDB, sync.parseContent(conf.syncData));
    }
};
sync.checkLocalChange = (language) => {
    // console.log('===== sync.checkLocalChange =====');
    // console.log('language: ', language);

    // Step 1: if conf.syncData does not existed this language add to syncData
    // Step 2: if sync language is change, update new language and time

    let found = false;
    let isUpdate = false;

    for (let i = 0; i < conf.syncData.length ; i++) {
        let o = conf.syncData[i];

        if (o.ResourceID === language.ResourceID ) {
            found = true;

            if (!o.LocalVietNamese || o.LocalVietNamese !== language.LocalVietNamese) {
                isUpdate = true;
                conf.syncData[i].LocalVietNamese = language.LocalVietNamese;
                conf.syncData[i].LocalTime = syncTime();
            }
            if (!o.LocalEnglish || o.LocalEnglish !== language.LocalEnglish) {
                isUpdate = true;
                conf.syncData[i].LocalEnglish = language.LocalEnglish;
                conf.syncData[i].LocalTime = syncTime();
            }
        }
    }

    if (!found) {
        isUpdate = true;
        conf.syncData.push(language);
    }

    return isUpdate;
};
sync.checkServerChange = (language) => {
    // console.log('===== sync.checkServerChange =====');
    // console.log('language: ', language);

    // Step 1: if conf.syncData does not existed this language add to syncData
    // Step 2: if sync language is change, update new language and time

    let found = false;
    let isUpdate = false;

    for (let i = 0; i < conf.syncData.length ; i++) {
        let o = conf.syncData[i];

        if (o.ResourceID === language.ResourceID) {
            found = true;

            if (!o.ServerVietNamese || o.ServerVietNamese !== language.ServerVietNamese) {
                isUpdate = true;
                conf.syncData[i].ServerVietNamese = language.ServerVietNamese;
                conf.syncData[i].ServerTime = syncTime();
            }
            if (!o.ServerEnglish || o.ServerEnglish !== language.ServerEnglish) {
                isUpdate = true;
                conf.syncData[i].ServerEnglish = language.ServerEnglish;
                conf.syncData[i].ServerTime = syncTime();
            }
        }
    }

    if (!found) {
        isUpdate = true;
        conf.syncData.push(language);
    }

    return isUpdate;
};
sync.applySyncToLocal = async () => {
    console.log('===== sync.applySyncToLocal =====');

    if (!conf.syncData || conf.syncData.length < 1) {
        return false;
    }

    // Step 1: Check LocalVietNamese or LocalEnglish does not exited, add new language
    // Step 2: Compare time update to choose Local or Server language

    let data = [];

    // Check
    for (let i = 0; i < conf.syncData.length; i++) {
        const o = conf.syncData[i];
        const n = {};

        const prefix = o.ResourceID.substring(0, conf.outputPrefix.length);

        // Add prefix to resource
        if (conf.outputPrefix && conf.outputPrefix !== "N/A" && prefix !== conf.outputPrefix) {
            o.ResourceID = conf.outputPrefix + o.ResourceID;
        }

        n.ResourceID = o.ResourceID;
        n.VietNamese = o.LocalVietNamese ? o.LocalVietNamese : o.ServerVietNamese;
        n.English = o.LocalEnglish ? o.LocalEnglish : o.ServerEnglish;

        if (o.ServerTime > o.LocalTime) {
            n.VietNamese = o.ServerVietNamese ? o.ServerVietNamese : n.VietNamese;
            n.English = o.ServerEnglish ? o.ServerEnglish : n.English;
        }

        data.push(n);
    }

    // Write new localize
    let newLol = {};
    let enLang = {};
    let viLang = {};

    sortByKey(data, "ResourceID");
    for (let i = 0; i < data.length; i++) {
        const l = data[i];

        enLang[l.ResourceID] = l.English;
        viLang[l.ResourceID] = l.VietNamese;
    }

    newLol.en = enLang;
    newLol.vi = viLang;

    // console.log('===== newLol: ', newLol);
    let str = "var localize = " + JSON.stringify(newLol)+";";

    str = str.replace("= {", "= {\n\t");
    str = str.replace("\"en\":{\"", "\"en\":{\n\t\t\"");
    str = str.replace(/ *","*/g, "\",\n\t\t\"");
    str = str.replace(",\"vi\":{\"", ",\n\t\"vi\":{\n\t\t\"");
    str = str.replace("}};", "\n\t}\n};");

    await sync.write(conf.fileLG, str);
};
sync.applySyncToServer = async () => {
    console.log('===== sync.applySyncToServer =====');

    if (!conf.syncData || conf.syncData.length < 1) {
        return false;
    }

    // Step 1: Check ServerVietNamese or ServerEnglish does not exited, build the SQL add new language
    // Step 2: Compare time update to choose Local or Server language, build the update SQL

    let uSQL = "";
    let aSQL = "";

    // Check
    for (let i = 0; i < conf.syncData.length; i++) {
        const o = conf.syncData[i];
        const n = {};

        n.ResourceID = escape(o.ResourceID);
        n.VietNamese = o.ServerVietNamese ? o.ServerVietNamese : o.LocalVietNamese;
        n.English = o.ServerEnglish ? o.ServerEnglish : o.LocalEnglish;

        // const prefix = n.ResourceID.substring(0, conf.prefix.length);
        //
        // // Add prefix to resource
        // if (prefix !== conf.prefix) {
        //     n.ResourceID = conf.prefix + n.ResourceID;
        // }

        if (!o.ServerTime) {
            // Build the add new SQL
            let addTemplate = conf.sqlAddTemplate;

            addTemplate = addTemplate.replace("{ResourceID}", n.ResourceID);
            addTemplate = addTemplate.replace("{ModuleID}", escape(conf.module));
            addTemplate = addTemplate.replace("{ProductID}", escape(conf.productID));
            addTemplate = addTemplate.replace("{VietNamese}", escape(n.VietNamese));
            addTemplate = addTemplate.replace("{English}", escape(n.English));

            aSQL += addTemplate + "\n";

        } else  if (o.LocalTime > o.ServerTime) {
            // Build the update SQL
            n.VietNamese = o.LocalVietNamese ? o.LocalVietNamese : n.VietNamese;
            n.English = o.LocalEnglish ? o.LocalEnglish : n.English;

            let updateTemplate = conf.sqlUpdateTemplate;

            updateTemplate = updateTemplate.replace("{ResourceID}", n.ResourceID);
            updateTemplate = updateTemplate.replace("{ModuleID}", escape(conf.module));
            updateTemplate = updateTemplate.replace("{ProductID}", escape(conf.productID));
            updateTemplate = updateTemplate.replace("{VietNamese}", escape(n.VietNamese));
            updateTemplate = updateTemplate.replace("{English}", escape(n.English));

            uSQL += updateTemplate + "\n";
        }
    }

    return aSQL + uSQL;
};
sync.start = async (option) => {
    console.log('===== sync.start =====');
    // console.log('===== option: ', option);

    // Update option
    if (option) {
        Object.keys(option).forEach(function (key) {
            const o = option[key];
            // console.log('===== o: ', o);

            if (conf && conf[key]) {
                conf[key] = o;
            }
        });
    }

    if (conf.secret !== "N/A" && conf.connection !== "N/A") {
        const deStr = decrypt(conf.connection, conf.secret);
        const deObj = JSON.parse(deStr);
        if (deObj && deObj.user) {
            conf.user = deObj.user;
        }
        if (deObj && deObj.password) {
            conf.password = deObj.password;
        }
        if (deObj && deObj.server) {
            conf.server = deObj.server;
        }
        if (deObj && deObj.database) {
            conf.database = deObj.database;
        }
    }

    if (!conf.productID || conf.productID === 'N/A') {
        console.log('===== sync.message - Missing productID =====');
        console.log('===== sync.end =====');
        return 'done';
    }

    // Step 1: Check and sync data existed
    try {
        const syncData =  await sync.read(conf.fileDB);
        if (syncData) {
            conf.syncData = JSON.parse(syncData);
        }
    } catch (e) {
        console.log('===== e: ', e);
        await sync.write(conf.fileDB, "");
        console.log('===== sync.end =====');
        return "done";
    }
    // console.log('===== conf.syncData: ', conf.syncData);

    // Step 2: Update local to sync data
    await sync.updateFromLocal();

    // Step 3: Update server to sync data
    await sync.updateFromServer();
    //
    // // Step 4: Apply change to localize
    if (conf.syncToLocal && conf.syncToLocal !== 'N/A') {
        await sync.applySyncToLocal();
    }
    //
    // Step 5: Apply change to database
    const aSQL = await sync.applySyncToServer();
    // console.log("=== aSQL:\n", aSQL);

    if (aSQL && aSQL.length > 0) {
        const result = await sync.query(aSQL);

        if (result) {
            console.log('===== result: Sync successfully!');
        }
    }

    console.log('===== sync.end =====');
    process.exit();
    return null;
};

module.exports = sync;
