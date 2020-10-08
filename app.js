require('dotenv').config();

const express = require('express');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
const router = require('./routes');

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

let countDowns = [];
let worksheets = [];

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('joinRoom', (room) => {
    // const rooms = Object.keys(socket.rooms);
    // for (let i = 1; i < rooms.length; i++) {
    //   console.log(rooms[i]);
    //   socket.leave(rooms[i]);
    // }

    socket.join(room);
  });

  socket.on('leaveRoom', (room) => {
    socket.leave(room);
  });

  socket.on('startSessionTimer', (data) => {
    const { startTime, endTime, workgroup, worksheetId } = data;
    const remainingTime = endTime - Date.now();

    let countdown;

    if (remainingTime > 0) {
      countdown = setInterval(() => {
        const sessionHasStarted = Date.now() >= startTime;
        const remainingTimeCurrent = endTime - Date.now();
        const sessionHasEnded = remainingTimeCurrent <= 0;

        if (!sessionHasStarted) return;
        if (sessionHasEnded) {
          const foundWorksheet = worksheets.filter((worksheet) => worksheet.id === worksheetId);

          if (foundWorksheet[0]) {
            worksheets = worksheets.filter((worksheet) => worksheet.id !== worksheetId);
          }

          const found = countDowns.filter((c) => c.id === `session-timer-${workgroup}`);

          if (found[0]) {
            clearInterval(found[0].countdown);

            countDowns = countDowns.filter((c) => c.id !== `session-timer-${workgroup}`);
          }
        }

        const duration = endTime - Date.now();
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

        io.sockets.in(workgroup).emit('workgroupSessionTimer', {
          seconds: seconds < 10 ? `0${seconds}` : seconds,
          minutes,
          duration,
        });
      }, 200);

      countDowns.push({ id: `session-timer-${workgroup}`, countdown });
    }
  });

  socket.on('startTurnTimer', (data) => {
    const { startTime, endTime, turn_time, workgroup, user, students, currentTurn } = data;

    const sessionWasCreated = countDowns.filter((c) => c.id === workgroup);
    const sessionHasFinished = Date.now() >= endTime;

    if (sessionHasFinished) return;
    if (sessionWasCreated.length) return;

    let currentTurnCopy = currentTurn;
    let turnEndTime = startTime + turn_time;
    let studentsCopy = [...students];

    const countdown = setInterval(() => {
      const sessionHasStarted = Date.now() >= startTime;
      const remainingTime = endTime - Date.now();
      const sessionHasEnded = remainingTime <= 0;
      const duration = turnEndTime - Date.now();

      if (!sessionHasStarted) return;

      if (sessionHasEnded) {
        const found = countDowns.filter((c) => c.id === workgroup);

        io.sockets.in(workgroup).emit('studentTurnTimer', { ...data, completed: true });

        if (found[0]) {
          clearInterval(found[0].countdown);

          countDowns = countDowns.filter((c) => c.id !== workgroup);
        }
      }

      if (duration <= 0) {
        turnEndTime += turn_time;

        currentTurnCopy += 1;

        studentsCopy = studentsCopy.filter((student) => {
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
        const studentTurn = studentsCopy.filter((student) => student.turn && student)[0];

        const timerData = {
          duration,
          minutes,
          seconds: seconds < 10 ? `0${seconds}` : seconds,
          completedTurn: duration < 0,
          remainingTime,
          currentTurn: currentTurnCopy,
          studentTurn,
        };

        io.sockets.in(workgroup).emit('studentTurnTimer', timerData);
      }
    }, 200);

    countDowns.push({ id: workgroup, countdown });
  });

  socket.on('get_worksheet', (payload) => {
    // payload: id, email, canvas, image_url
    // console.log(worksheets[0])
    const findIndexworksheet = worksheets.findIndex((worksheet) => worksheet.id === payload.id);
    // console.log(worksheets[findIndexworksheet], "???????????")
    if (findIndexworksheet >= 0) {
      socket.emit(`get_worksheet_${payload.email}`, worksheets[findIndexworksheet]);
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

  socket.on('update_answer', (answer) => {
    if (!answer.hasStarted && Date.now() > answer.endTime) return;

    socket.to(answer.group).emit('update_answer', answer);

    const findIndexworksheet = worksheets.findIndex((worksheet) => worksheet.id === answer.id);

    worksheets[findIndexworksheet] = {
      ...answer,
      id: answer.id,
      canvas: answer.canvas,
      image_url: answer.image_url,
    };

    const allTeacherWorksheets = worksheets.filter(
      (worksheet) => worksheet.teacher && worksheet.teacher.id === answer.teacher.id,
    );

    io.sockets
      .in(`teacher-workgroups-${answer.teacher.id}`)
      .emit('teacher-worksheets', allTeacherWorksheets);

    // Worksheet.updateWorksheet(answer.id, {
    //   image_url: "",
    //   canvas: answer.canvas
    // })
  });

  socket.on('start_workgroup', (workgroup) => {
    // console.log('aaaaaaa');
    socket.to(workgroup.room).emit('start_workgroup', workgroup.id);
  });

  socket.on('raise_hand', (payload) => {
    // { room, name }
    socket.to(payload.room).emit('raise_hand', payload.name);
  });

  socket.on('send_worksheets', (id) => {
    const allTeacherWorksheets = worksheets.filter(
      (worksheet) => worksheet.teacher && worksheet.teacher.id === id,
    );

    io.sockets.in(`teacher-workgroups-${id}`).emit('teacher-worksheets', allTeacherWorksheets);
  });

  socket.on('worksheetConfirmation', (data) => {
    const {
      groupId,
      classroomId,
      submission: { half, students, confirmedBy },
    } = data;

    const submissionCopy = { ...data.submission };

    if (half >= students.length) {
      submissionCopy.allConfirmed = true;
    }

    if (!submissionCopy.allConfirmed) {
      socket
        .to(`classroom-${classroomId}-workgroup-${groupId}`)
        .emit('alertSubmitted', confirmedBy);
    }

    io.sockets
      .in(`classroom-${classroomId}-workgroup-${groupId}`)
      .emit('submissionData', submissionCopy);
  });
});

http.listen(PORT, () => {
  console.log('listening on *:', process.env.PORT || 3001);
});
