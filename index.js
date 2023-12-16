// импорт экспресса
var express = require('express');

// path модуль
var path = require('path');

// экззмепляр приложения
var app = express();

// импорт игрового файла
var agx = require('./agxgame');

// создание приложения
app.configure(function () {

    app.use(express.logger('dev'));

    // ищем все ресурсы в public
    app.use(express.static(path.join(__dirname, 'public')));
});

//ставим порт 8080
var server = require('http').createServer(app).listen(process.env.PORT || 8080);

// socket io привязываем к http серверу
var io = require('socket.io').listen(server);


io.set('log level', 1);

// слушаем подключения, как только только подключился запускаем игровую логику
io.sockets.on('connection', function (socket) {
    //console.log('client connected');
    agx.initGame(io, socket);
});


