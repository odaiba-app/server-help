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

  socket.on('endSession', (data) => {
    const foundWorksheet = worksheets.filter((worksheet) => worksheet.id === data.worksheetId);

    if (foundWorksheet[0]) {
      worksheets = worksheets.filter((worksheet) => worksheet.id !== data.worksheetId);
    }

    const foundSessionTimer = countDowns.filter((c) => c.id === `session-timer-${data.workgroup}`);
    const foundTurnTimer = countDowns.filter((c) => c.id === data.workgroup);

    if (foundSessionTimer[0]) {
      clearInterval(foundSessionTimer[0].countdown);

      countDowns = countDowns.filter((c) => c.id !== `session-timer-${data.workgroup}`);
    }

    if (foundTurnTimer[0]) {
      clearInterval(foundTurnTimer[0].countdown);

      countDowns = countDowns.filter((c) => c.id !== data.workgroup);
    }

    io.sockets.in(data.workgroup).emit('studentTurnTimer', { ...data, completed: true });
  });

  socket.on('startSessionTimer', (data) => {
    const { endTime, workgroup, worksheetId } = data;
    const remainingTime = endTime - Date.now();

    let countdown;

    if (remainingTime > 0) {
      countdown = setInterval(() => {
        const remainingTimeCurrent = endTime - Date.now();
        const sessionHasEnded = remainingTimeCurrent <= 0;

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
    const { startTime, turn_time, workgroup, user, students } = data;

    const sessionWasCreated = countDowns.filter((c) => c.id === workgroup);

    if (sessionWasCreated.length) return;

    let turnEndTime = startTime + turn_time;
    let studentsCopy = [...students];
    let numOfTurnsComplete = 0;

    const countdown = setInterval(() => {
      const duration = turnEndTime - Date.now();

      if (duration <= 0) {
        numOfTurnsComplete += 1;

        turnEndTime += turn_time;

        const numOfStudents = students.length;

        if (numOfStudents === numOfTurnsComplete) {
          numOfTurnsComplete = 0;

          studentsCopy = [...students].map((student, idx) => {
            const studentCopy = { ...student };

            if (idx === numOfStudents - 1) {
              studentCopy.turn = true;
            } else {
              studentCopy.turn = false;
            }

            return studentCopy;
          });
        } else {
          studentsCopy = studentsCopy.filter((student) => {
            if (!student.turn && student.user.id !== user.id) {
              return student;
            }
          });

          if (studentsCopy.length) {
            studentsCopy[0].turn = true;
          }
        }

        return;
      }
      const seconds = Math.floor((duration % (1000 * 60)) / 1000);
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

      const studentTurn = studentsCopy.filter((student) => student.turn && student)[0];

      const timerData = {
        duration,
        minutes,
        seconds: seconds < 10 ? `0${seconds}` : seconds,
        completedTurn: duration < 0,
        studentTurn,
      };

      io.sockets.in(workgroup).emit('studentTurnTimer', timerData);
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
    console.log(socket.rooms)
    const {
      groupId,
      classroomId,
      worksheetId,
      submission: { half, students, confirmedBy },
    } = data;

    const submissionCopy = { ...data.submission };

    if (Math.ceil(half) >= students.length) {
      submissionCopy.allConfirmed = true;
    }

    worksheets.forEach((w) => console.log(w.id));
    const room = `classroom-${classroomId}-workgroup-${groupId}` // classroom-1-workgroup-50
    if (!submissionCopy.allConfirmed) {
      socket
        .to(room)
        .emit('alertSubmitted', confirmedBy);
    } else if (submissionCopy.allConfirmed) {
      const myWorksheet = worksheets.filter(
        (worksheet) => worksheet.id && worksheet.id === worksheetId,
      );

      console.log(data)
      if (myWorksheet.length) {
        io.sockets.in(room).emit('submissionData', {
          allConfirmed: submissionCopy.allConfirmed,
          worksheetId,
          canvas: myWorksheet[0].canvas,
          image_url: myWorksheet[0].image_url,
        });
      }
    }
  });
});

http.listen(PORT, () => {
  console.log('listening on *:', process.env.PORT || 3001);
});
