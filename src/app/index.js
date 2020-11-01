const path = require('path');
const fs = require('fs');
const nodemailer = require("nodemailer");
const crypto = require('crypto');
const moment = require('moment');

// var win = nw.Window.get();
// win.showDevTools();

const ENCRYPTION_KEY = "16061728d891adab623730bc174eb1d4"; // Must be 256 bits (32 characters)
const IV_LENGTH = 16;

const allFiles = [];

const filePaths = {
  dbNotePath: path.join(nw.App.dataPath, 'notes.db'),
  dbConfigPath: path.join(nw.App.dataPath, 'config.db')
};

const Datastore = require('nedb');
const dbNotes = new Datastore({ 
  filename: filePaths.dbNotePath, 
  autoload: true, 
  timestampData: true 
});

const dbConfig = new Datastore({ 
  filename: filePaths.dbConfigPath, 
  autoload: true, 
  timestampData: true 
});

function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
 
  encrypted = Buffer.concat([encrypted, cipher.final()]);
 
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
 
 function decrypt(text) {
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
 
  decrypted = Buffer.concat([decrypted, decipher.final()]);
 
  return decrypted.toString();
} 

const kill = () => {
  nw.App.quit();
}

const getLocalFiles = (startFolder, extension) => {

  if (!fs.existsSync(startFolder))  {
    alert("diretorio não encontrado", startFolder);
    kill();
  }

  const files = fs.readdirSync(startFolder);
  for(var i = 0; i < files.length; i++){
    var filename = path.join(startFolder, files[i]);
    var stat = fs.lstatSync(filename);
    if (stat.isDirectory()){
      getLocalFiles(filename, extension); //recurse
    }
    else if (filename.indexOf(extension) >= 0) {
      var updateFile = moment(stat.mtime);
      var dateImport = moment("2020-10-01");
      if (updateFile.isSameOrAfter(dateImport)) {
        allFiles.push(filename);
      }
    };
  };
}

const saveFile = async (filename) => {
  return new Promise((resolve, reject) => {
    dbNotes.find({ filename }).limit(1).exec((err, docs) => {
      if (err) {
        return reject(err);
      }

      if (docs.length <= 0) {
        dbNotes.insert({
          filename,
          sync: 0
        }, (err, newDoc) => {
          if (err) {
            return reject(err);
          }
          return resolve();
        });
      } else {
        return resolve();
      }
    });
  });
};

const updateSyncFile = async (_id) => {
  return new Promise((resolve, reject) => {
    return dbNotes.update({ _id }, { $set: { sync: 1 } }, {}, (err, numReplaced) => {
      if (err) {
        return reject(err);
      }
      return resolve();
    });
  });
}

const sendEmail = async (smtpconfig, to) => {
  files = await getDontSyncFiles();
  smtpconfig.auth.pass = decrypt(smtpconfig.auth.pass);
  return new Promise(async (resolve, reject) => {
    let transporter = nodemailer.createTransport(smtpconfig);
    for (var i = 0; i < files.length; i++) {
      var absolutName = files[i].filename;
      var filename = absolutName.split('\\');
      filename = filename[filename.length - 1];

      let info = await transporter.sendMail({
        from: '"Notas" <no-reply@contagen.com.br>',
        to,
        subject: "Notas",
        text: "Mais uma!! ;)",
        attachments: [
          {
            filename,
            path: absolutName
          }
        ]
      });
      if (info.messageId) {
        await updateSyncFile(files[i]._id)
      }
    }
    return resolve();
  });
}

const getDontSyncFiles = async () => {
  return new Promise((resolve, reject) => {
    dbNotes.find({ sync: 0 }).exec((err, files) => {
      if (err) {
        return reject(err);
      }

      return resolve(files);
    })
  });
}

const getConfig = async ()  => {
  return new Promise((resolve, reject) => {
    return dbConfig.find().exec(async (err, docs) => {
      if (err) {
        return reject(err);
      }

      return resolve(docs);
    });
  });
}

const intConfig = async() => {
  return new Promise(async (resolve, reject) => {
    // let testAccount = await nodemailer.createTestAccount();

    const hash = encrypt("F'hxzM2}z]S'H4F");
    dbConfig.insert([{
      key: 'path',
      value: nw.App.dataPath
    }, {
      key: 'email',
      value: 'boxj.contagen.4335@jettax.com.br'
    }, {
      key: 'smtp',
      value: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: 'contagencontabil@gmail.com',
          pass: hash,
        }
      }
    }, {
      key: 'can_send_email',
      value: 0
    }], (err, newDoc) => {
      if (err) {
        return reject(err);
      }
      
      return resolve();
    });
  });
}

const init = async () => {
  return new Promise(async (resolve, reject) => {
    let config = await getConfig();
    if (config.length <= 0) {
      await intConfig();
      config = await getConfig();
    }
    const can_send_email = config.find((conf) => conf.key === 'can_send_email');
    if (can_send_email.value === 0) {
      alert(nw.App.dataPath);
      return resolve();
    }

    const xmlFolder = config.find((conf) => conf.key === 'path');
    getLocalFiles(xmlFolder.value, '.xml');

    for (var i = 0; i < allFiles.length; i++) {
      await saveFile(allFiles[i]);
    }

    const smtp = config.find((conf) => conf.key === 'smtp');
    const email = config.find((conf) => conf.key === 'email');
    await sendEmail(smtp.value, email.value);

    return resolve();
  });
}

init().finally(() => {
  kill();
});