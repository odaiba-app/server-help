if (process.env.NODE_ENV == "development") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const cors = require("cors");
const router = require("./routes");
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", router);

const users = require("./userDummies");
const sheets = require("./sheetDummies");

let db = {
  groups: [
    {
      id: 1,
      name: "Group 1",
      video_call_code: "Group1",
      turn_time: 60 * 5,
      session_time: 60 * 15,
      status: "onprogress",
      users: users[0],
      classroom_id: 1,
      score: 0,
      answered: 0,
      sheets: sheets[0],
      created_at: "2020-06-27T11:50:20.840Z",
      updated_at: "2020-06-27T11:50:20.840Z",
    },
    {
      id: 2,
      name: "Group 2",
      video_call_code: "Group2",
      turn_time: 60 * 5,
      session_time: 60 * 15,
      status: "onprogress",
      users: users[1],
      classroom_id: 1,
      score: 0,
      answered: 0,
      sheets: sheets[1],
      created_at: "2020-06-27T11:50:20.840Z",
      updated_at: "2020-06-27T11:50:20.840Z",
    },
  ],
};

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("joinRoom", function(room) {
    const rooms = Object.keys(socket.rooms);
    for (let i = 1; i < rooms.length; i++) {
      socket.leave(rooms[i]);
    }
    socket.join(room);
  });

  socket.on("getGroups", function(to) {
    realtimeGroup();
    console.log("masuk g?");
    // io.emit("realtime-groups", db.groups);
    io.emit(to, db.groups);
  });

  // get group by id
  socket.on("getWorkGroup", function(payload) {
    /* {
          id: 1,
          to: username
     }*/

    // console.log(payload);
    const indexGroup = db.groups.findIndex(function(r) {
      return r.id === Number(payload.id);
    });

    // console.log(db.groups[0].sheets);
    io.emit(`getWorkGroup-${payload.to}`, db.groups[indexGroup]);
  });

  // socket.on()

  socket.on("updateSheet", function(response) {
    const { sheets, groupid } = response;
    const indexGroup = db.groups.findIndex(function(r) {
      return r.id === Number(response.groupid);
    });
    console.log(indexGroup, "indexGroup");
    db.groups[indexGroup].sheets = response.sheets;
    // console.log(db.groups[indexGroup].sheets)
    if (response.sheets.length) {
      realtimeGroup();
    }
    console.log(db.groups[0].answered);
    console.log(db.groups[0].score);
    io.emit("realtime-groups", db.groups);
  });
  socket.on("answerQ", function(response) {
    console.log(response);
    socket.broadcast.to(response.room).emit("answerQ", response);
    realtimeGroup();
    io.emit("realtime-groups", db.groups);
  });
  socket.on("newQ", function() {
    /* body... */
    socket.broadcast.emit("newQ");
    realtimeGroup();
    io.emit("realtime-groups", db.groups);
  });
});

function realtimeGroup() {
  console.log("masuk gg");
  for (let i = 0; i < db.groups.length; i++) {
    db.groups[i].answered;
    let answered = 0;
    let score = 0;
    for (var j = 0; j < db.groups[i].sheets.length; j++) {
      if (db.groups[i].sheets[j].questions[2]) {
        answered++;
      }
      if (db.groups[i].sheets[j].questions[3]) {
        answered++;
      }
      if (
        db.groups[i].sheets[j].questions[2] ===
        db.groups[i].sheets[j].answers[2]
      ) {
        score += 5;
      }
      if (
        db.groups[i].sheets[j].questions[3] ===
        db.groups[i].sheets[j].answers[3]
      ) {
        score += 5;
      }
    }
    db.groups[i].answered = answered;
    db.groups[i].score = score;
  }
}

function turn_time(seconds, index, cb) {
  let duration = 60 * 5;
  let interval = setInterval(() => {
    db.groups[index].turn_time = seconds;

    if (--db.groups[index].session_time < 0) {
      db.groups[index].turn_time = 0;
      console.log("berhenti");
      cb();
      clearInterval(interval);
    }
    // console.log(seconds);
    if (--seconds < 0) {
      const indexOfTurn = db.groups[index].users.findIndex(function(r) {
        return r.turn === true;
      });
      db.groups[index].users[indexOfTurn].turn = false;

      if (indexOfTurn === db.groups[index].users.length - 1) {
        db.groups[index].users[0].turn = true;
        cb();
        // console.log(db.groups[index].users[0].turn, "000000");
      } else {
        db.groups[index].users[indexOfTurn + 1].turn = true;
        cb();
        // console.log(db.groups[index].users[indexOfTurn + 1].turn, "++++++");
        // db.groups[index].users[indexOfTurn + 1].name;
      }
      seconds = duration;
    }
  }, 1000);
}

app.get("/reset", (req, res) => {
  db = {
    groups: [
      {
        id: 1,
        name: "Group 1",
        video_call_code: "Group1",
        turn_time: 60 * 5,
        session_time: 60 * 15,
        status: "onprogress",
        users: users[0],
        classroom_id: 1,
        score: 0,
        answered: 0,
        sheets: sheets[0],
        created_at: "2020-06-27T11:50:20.840Z",
        updated_at: "2020-06-27T11:50:20.840Z",
      },
      {
        id: 2,
        name: "Group 2",
        video_call_code: "Group2",
        turn_time: 60 * 5,
        session_time: 60 * 15,
        status: "onprogress",
        users: users[1],
        classroom_id: 1,
        score: 0,
        answered: 0,
        sheets: sheets[1],
        created_at: "2020-06-27T11:50:20.840Z",
        updated_at: "2020-06-27T11:50:20.840Z",
      },
    ],
  };
  io.emit("reset", db.groups);
  io.emit("realtime-groups", db.groups)
  res.json(db);
});

http.listen(PORT, () => {
  console.log("listening on *:", process.env.PORT || 3001);
});
