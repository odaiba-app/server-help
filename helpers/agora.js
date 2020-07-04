const {
  RtcTokenBuilder,
  RtmTokenBuilder,
  RtcRole,
  RtmRole,
} = require("agora-access-token");

// Fill the appID and appCertificate key given by Agora.io
const appID = process.env.appID;
const appCertificate = process.env.appCertificate;

const expirationTimeInSeconds = 3600;
const role = RtcRole.PUBLISHER;

module.exports = {
  generateRtcToken(req, res) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    const channelName = req.query.channelName;
    // use 0 if uid is not specified
    const uid = req.query.uid || 0;
    if (!channelName) {
      return res.status(400).json({ error: "channel name is required" });
    }

    const key = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );

    // res.header("Access-Control-Allow-Origin", "*");
    //res.header("Access-Control-Allow-Origin", "http://ip:port")
    return res.json({ key: key }).send();
  },
  generateRtmToken() {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    const account = req.query.account;
    if (!account) {
      return res.status(400).json({ error: "account is required" });
    }

    const key = RtmTokenBuilder.buildToken(
      appID,
      appCertificate,
      account,
      RtmRole,
      privilegeExpiredTs
    );

    // res.header("Access-Control-Allow-Origin", "*");
    //res.header("Access-Control-Allow-Origin", "http://ip:port")
    return res.json({ key: key }).send();
  },
};
