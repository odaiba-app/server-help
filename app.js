if (process.env.NODE_ENV == "development") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const cors = require("cors");
const router = require("./routes");
const Worksheet = require("./helpers/Worksheet")
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", router);

const worksheets = []
/*
id: 
canvas: 
image_url
*/

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("joinRoom", function (room) {
    const rooms = Object.keys(socket.rooms);
    for (let i = 1; i < rooms.length; i++) {
      socket.leave(rooms[i]);
    }
    socket.join(room);
  });


  socket.on("get_worksheet", function (payload) {
    // payload: id, email, canvas, image_url
    // console.log(worksheets[0])
    const findIndexworksheet = worksheets.findIndex(worksheet => worksheet.id === payload.id)
    // console.log(worksheets[findIndexworksheet], "???????????")
    if (findIndexworksheet >= 0) {
      socket.emit(`get_worksheet_${payload.email}`, worksheets[findIndexworksheet])
    } else {
      const worksheet = {
        id: payload.id,
        canvas: payload.canvas,
        image_url: payload.image_url
      }
      worksheets.push(worksheet)

      socket.emit(`get_worksheet_${payload.email}`, worksheet)
    }
  })

  socket.on("getGroups", function (to) {
    console.log("masuk g?");
    // io.emit("realtime-groups", db.groups);
    io.emit(to, db.groups);
  });


  socket.on("update_answer", function (answer) {
    // console.log(socket.rooms)
    socket.to(answer.group).emit("update_answer", answer);

    const findIndexworksheet = worksheets.findIndex(worksheet => worksheet.id === answer.id)
    // console.log(answer.canvas)
    worksheets[findIndexworksheet] = {
      id: answer.id,
      canvas: answer.canvas,
      image_url: answer.image_url
    }
    // Worksheet.updateWorksheet(answer.id, {
    //   image_url: "",
    //   canvas: answer.canvas
    // })
  })

  socket.on("start_workgroup", function (workgroup) {
    console.log("aaaaaaa")
    socket.to(workgroup.room).emit("start_workgroup", workgroup.id)
  })
});


http.listen(PORT, () => {
  console.log("listening on *:", process.env.PORT || 3001);
});

