if (process.env.NODE_ENV == 'development') {
  require('dotenv').config();
}

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
const router = require('./routes');
const { isObject } = require('util');
// const Worksheet = require('./helpers/Worksheet');
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

let countDowns = [];
const worksheets = [];
/*
id: 
canvas: 
image_url
*/

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('joinRoom', function (room) {
    // const rooms = Object.keys(socket.rooms);
    // for (let i = 1; i < rooms.length; i++) {
    //   console.log(rooms[i]);
    //   socket.leave(rooms[i]);
    // }

    socket.join(room);
  });

  socket.on('leaveRoom', function (room) {
    socket.leave(room);
  });

  socket.on('startSessionTimer', function (data) {
    let {
      hasStarted,
      startTime,
      endTime,
      turn_time,
      workgroup,
      remainingTime,
    } = data;

    if (remainingTime > 0) {
      countdown = setInterval(() => {
        const sessionHasStarted = Date.now() >= startTime;
        const sessionHasEnded = remainingTime <= 0;

        if (!sessionHasStarted) return;
        if (sessionHasEnded) {
          let found = countDowns.filter((c) => {
            return c.id === workgroup;
          });

          if (found[0]) {
            clearInterval(found[0].countdown);
          }
        }

        const duration = endTime - Date.now();
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

        io.sockets.in(workgroup).emit('workgroupSessionTimer', {
          seconds: seconds < 10 ? '0' + seconds : seconds,
          minutes,
          duration,
        });
      }, 200);
    }
  });

  socket.on('startTurnTimer', function (data) {
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
      const sessionHasStarted = Date.now() >= startTime;
      const remainingTime = endTime - Date.now();
      const sessionHasEnded = remainingTime <= 0;
      let duration = turnEndTime - Date.now();

      if (!sessionHasStarted) return;

      if (sessionHasEnded) {
        let found = countDowns.filter((c) => {
          return c.id === workgroup;
        });

        if (found[0]) {
          countDowns = countDowns.filter((c) => {
            return c.id !== workgroup;
          });
        }
      }

      if (duration <= 0) {
        turnEndTime = turnEndTime + turn_time;

        currentTurnCopy += 1;

        studentsCopy = studentsCopy.filter((student, idx) => {
          if (!student.turn && student.user.id !== user.id) {
            return student;
          }
        });

        if (studentsCopy.length) {
          studentsCopy[0].turn = true;
        }

        return;
      }

      const seconds = Math.floor((duration % (1000 * 60)) / 1000);
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

      if (Date.now() < endTime) {
        let studentTurn = studentsCopy.filter(
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

        io.sockets.in(workgroup).emit('studentTurnTimer', data);

        // console.log({
        //   duration,
        //   minutes,
        //   seconds: seconds < 10 ? '0' + seconds : seconds,
        //   completedTurn: duration < 0,
        //   remainingTime: remainingTime,
        //   currentTurn: currentTurnCopy,
        //   studentTurn,
        // });
      }
    }, 200);

    countDowns.push({ id: workgroup, countdown });
  });

  socket.on('get_worksheet', function (payload) {
    // payload: id, email, canvas, image_url
    // console.log(worksheets[0])
    const findIndexworksheet = worksheets.findIndex(
      (worksheet) => worksheet.id === payload.id
    );
    // console.log(worksheets[findIndexworksheet], "???????????")
    if (findIndexworksheet >= 0) {
      socket.emit(
        `get_worksheet_${payload.email}`,
        worksheets[findIndexworksheet]
      );
    } else {
      const worksheet = {
        id: payload.id,
        canvas: payload.canvas,
        image_url: payload.image_url,
      };
      worksheets.push(worksheet);

      socket.emit(`get_worksheet_${payload.email}`, worksheet);
    }
  });

  socket.on('getGroups', function (to) {
    console.log('masuk g?');
    // io.emit("realtime-groups", db.groups);
    io.emit(to, db.groups);
  });

  socket.on('update_answer', function (answer) {
    if (!answer.hasStarted && Date.now() > answer.endTime) return;

    socket.to(answer.group).emit('update_answer', answer);

    const findIndexworksheet = worksheets.findIndex(
      (worksheet) => worksheet.id === answer.id
    );

    worksheets[findIndexworksheet] = {
      ...answer,
      id: answer.id,
      canvas: answer.canvas,
      image_url: answer.image_url,
    };

    const allTeacherWorksheets = worksheets.filter(
      (worksheet) =>
        worksheet.teacher && worksheet.teacher.id === answer.teacher.id
    );

    io.sockets
      .in(`teacher-workgroups-${answer.teacher.id}`)
      .emit('teacher-worksheets', allTeacherWorksheets);

    // Worksheet.updateWorksheet(answer.id, {
    //   image_url: "",
    //   canvas: answer.canvas
    // })
  });

  socket.on('start_workgroup', function (workgroup) {
    // console.log('aaaaaaa');
    socket.to(workgroup.room).emit('start_workgroup', workgroup.id);
  });

  socket.on('raise_hand', function (payload) {
    // { room, name }
    socket.to(payload.room).emit('raise_hand', payload.name);
  });

  socket.on('send_worksheets', function (id) {
    const allTeacherWorksheets = worksheets.filter(
      (worksheet) => worksheet.teacher && worksheet.teacher.id === id
    );

    io.sockets
      .in(`teacher-workgroups-${id}`)
      .emit('teacher-worksheets', allTeacherWorksheets);
  });
});

http.listen(PORT, () => {
  console.log('listening on *:', process.env.PORT || 3001);
});
