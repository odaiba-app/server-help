const router = require("express").Router();
const { generateRtcToken, generateRtmToken } = require("../helpers/agora");

router.get("/", (req, res) => {
  res.send("hello there");
});
router.get("/rtcToken", generateRtcToken);
router.get("/rtmToken", generateRtmToken);

module.exports = router;
