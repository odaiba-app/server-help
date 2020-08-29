if (process.env.NODE_ENV == 'development') {
  require('dotenv').config();
}

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
const router = require('./routes');
const Worksheet = require('./helpers/Worksheet');
const e = require('express');
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

const countDowns = [];

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('joinRoom', function (room) {
    console.log(room);
    const rooms = Object.keys(socket.rooms);
    for (let i = 1; i < rooms.length; i++) {
      socket.leave(rooms[i]);
    }

    socket.join(room);
    io.sockets.in(`workgroup-1`).emit('studentTurnTimer', 'hi');
  });

  socket.on('leftWorkgroup', function (username) {
    let found = countDowns.filter((c) => {
      return c.id === user.name;
    });
  });

  socket.on('turnData', function (data) {
    let {
      hasStarted,
      startTime,
      endTime,
      turn_time,
      workgroup,
      remainingTime,
      user,
      students,
      currentTurn,
    } = data;

    const sessionWasCreated = countDowns.filter((c) => {
      return c.id === workgroup;
    });
    const sessionHasFinished = Date.now() >= endTime;

    if (sessionHasFinished) return;
    if (sessionWasCreated.length) return;

    let currentTurnCopy = currentTurn;
    let turnEndTime = startTime + turn_time;
    let studentsCopy = [...students];

    let countdown = setInterval(() => {
      const remainingTime = endTime - Date.now();
      const sessionHasEnded = remainingTime <= 0;
      let duration = turnEndTime - Date.now();

      if (sessionHasEnded) {
        let found = countDowns.filter((c) => {
          console.log(c, workgroup);
          return c.id === workgroup;
        });

        if (found[0]) {
          console.log('clearing');
          clearInterval(found[0].countdown);
        }
      }

      if (duration <= 0) {
        turnEndTime = turnEndTime + turn_time;
        currentTurnCopy += 1;

        studentsCopy = studentsCopy.filter((student, idx) => {
          if (!student.turn && student.user.id !== user.id) {
            console.log(student, idx);
            if (idx === 1) {
              student.turn = true;
            }
            return student;
          }
        });
        return;
      }

      const seconds = Math.floor((duration % (1000 * 60)) / 1000);
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

      if (Date.now() < endTime) {
        const studentTurn = studentsCopy.filter(
          (student) => student.turn && student
        )[0];

        const data = {
          duration,
          minutes,
          seconds: seconds < 10 ? '0' + seconds : seconds,
          completedTurn: duration < 0,
          remainingTime: remainingTime,
          currentTurn: currentTurnCopy,
          studentTurn,
        };

        const rooms = Object.keys(socket.rooms);
        for (let i = 1; i < rooms.length; i++) {
          console.log(rooms);
        }
        io.sockets.in(workgroup).emit('studentTurnTimer', data);

        console.log({
          duration,
          minutes,
          seconds: seconds < 10 ? '0' + seconds : seconds,
          completedTurn: duration < 0,
          remainingTime: remainingTime,
          currentTurn: currentTurnCopy,
          studentTurn,
        });
      }
    }, 1000);

    countDowns.push({ id: workgroup, countdown });
  });

  socket.on('getGroups', function (to) {
    console.log('masuk g?');
    // io.emit("realtime-groups", db.groups);
    io.emit(to, db.groups);
  });

  socket.on('update_answer', function (answer) {
    console.log(socket.rooms);
    socket.to(answer.group).emit('update_answer', answer);
    // Worksheet.updateWorksheet(answer.id, {
    //   image_url: "",
    //   canvas: answer.canvas
    // })
  });

  socket.on('start_workgroup', function (workgroup) {
    console.log('aaaaaaa');
    socket.to(workgroup.room).emit('start_workgroup', workgroup.id);
  });
});

http.listen(PORT, () => {
  console.log('listening on *:', process.env.PORT || 3001);
});
