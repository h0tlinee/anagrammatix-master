;
jQuery(function ($) {
    'use strict';

    /**
     * 
     *
     * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, onNewWordData: Function, hostCheckAnswer: Function, gameOver: Function, error: Function}}
     */
    var IO = {

        /*вызывается когда странциа прогрузилась
         */
        init: function () {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        /**
         список событий
         */
        bindEvents: function () {
            IO.socket.on('connected', IO.onConnected);
            IO.socket.on('newGameCreated', IO.onNewGameCreated);
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);
            IO.socket.on('beginNewGame', IO.beginNewGame);
            IO.socket.on('newWordData', IO.onNewWordData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('gameOver', IO.gameOver);
            IO.socket.on('error', IO.error);
        },

        /**
         клиент успешно подключился
         */
        onConnected: function () {
            //в app пихаем сокет
            App.mySocketId = IO.socket.socket.sessionid;
            console.log(data.message);
        },

        /**
         * игра создана и получила случайный id
         * @param data {{ gameId: int, mySocketId: * }}
         */
        onNewGameCreated: function (data) {
            App.Host.gameInit(data);
        },

        /**
         * игрок подключился к игре
         * @param data {{playerName: string, gameId: int, mySocketId: int}}
         */
        playerJoinedRoom: function (data) {
            // вызываем update waiting screen
            //для хоста либо для игркоа
            //

            App[App.myRole].updateWaitingScreen(data);
        },

        /**
         * оба игрока присоединились, начинаем игру
         * @param data
         */
        beginNewGame: function (data) {
            App[App.myRole].gameCountdown(data);
        },

        /**
         * получаем от сервера новый набор слов
         * @param data
         */
        onNewWordData: function (data) {
            //обновили раунд
            App.currentRound = data.round;

            //поменяли слова на новые
            App[App.myRole].newWord(data);
        },

        /**
         * игрок дал ответ, если хост то проверяем ответ
         * @param data
         */
        hostCheckAnswer: function (data) {
            if (App.myRole === 'Host') {
                App.Host.checkAnswer(data);
            }
        },

        /**
         * конец игры
         * @param data
         */
        gameOver: function (data) {
            App[App.myRole].endGame(data);
        },

        /**
         * при ошибке
         * @param data
         */
        error: function (data) {
            alert(data.message);
        }

    };

    var App = {

        /**
         * отслеживаем gameid
         *
         */
        gameId: 0,

        /**
         * роль хоста или игрока
         */
        myRole: '',   // 'Player' или 'Host'

        /**
         * id socket io, уникален для каждого подключения(логично)
         */
        mySocketId: '',

        /**
         раунд
         */
        currentRound: 0,



        /**
         при загрузке страницы подгружаем скрипты
         */
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();


            FastClick.attach(document.body);
        },

        /**
         создаем связи для шаблонов
         */
        cacheElements: function () {
            App.$doc = $(document);

            // сами шаблоны
            App.$gameArea = $('#gameArea');
            App.$templateIntroScreen = $('#intro-screen-template').html();
            App.$templateNewGame = $('#create-game-template').html();
            App.$templateJoinGame = $('#join-game-template').html();
            App.$hostGame = $('#host-game-template').html();
        },

        /**
         обработчики для кнопок
         */
        bindEvents: function () {
            //для хоста
            App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);

            //для игрока
            App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
            App.$doc.on('click', '#btnStart', App.Player.onPlayerStartClick);
            App.$doc.on('click', '.btnAnswer', App.Player.onPlayerAnswerClick);
            App.$doc.on('click', '#btnPlayerRestart', App.Player.onPlayerRestart);
        },

        /* 
        логика
        */

        /**
         заглавный экран с создать и присоединиться
         */
        showInitScreen: function () {
            App.$gameArea.html(App.$templateIntroScreen);
            App.doTextFit('.title');
        },


        /*
        ХОСТ
        */
        Host: {

            /*информация об игроках
             */
            players: [],

            /**
             флаг новой игры
             */
            isNewGame: false,

            /**
             кол-во игроков
             */
            numPlayersInRoom: 0,

            /**
             следим за правильным ответом
             */
            currentCorrectAnswer: '',

            /**
            обработчик старта игры
             */
            onCreateClick: function () {
                console.log('Clicked "Create A Game"');
                IO.socket.emit('hostCreateNewGame');
            },

            /**
             хост экран
             * @param data{{ gameId: int, mySocketId: * }}
             */
            gameInit: function (data) {
                App.gameId = data.gameId;
                App.mySocketId = data.mySocketId;
                App.myRole = 'Host';
                App.Host.numPlayersInRoom = 0;

                App.Host.displayNewGameScreen();
                console.log("Game started with ID: " + App.gameId + ' by host: ' + App.mySocketId);
            },

            /**
             экран хоста с URL и id комнаты
             */
            displayNewGameScreen: function () {

                App.$gameArea.html(App.$templateNewGame);

                //отображение url
                $('#gameURL').text(window.location.href);
                App.doTextFit('#gameURL');

                // id
                $('#spanNewGameCode').text(App.gameId);
            },

            /**
             обновление экрана хоста при присоедиении
             * @param data{{playerName: string}}
             */
            updateWaitingScreen: function (data) {
                // если это перезапуск
                if (App.Host.isNewGame) {
                    App.Host.displayNewGameScreen();
                }
                // само обновление
                $('#playersWaiting')
                    .append('<p/>')
                    .text('Игрок ' + data.playerName + ' присоединился к игре.');

                // храним в хосте информацию о новом игроке
                App.Host.players.push(data);

                // увеличиваем кол во игроков
                App.Host.numPlayersInRoom += 1;

                // если игрока 2 начинаем игру
                if (App.Host.numPlayersInRoom === 2) {
                    console.log('Room is full. Almost ready!');

                    // говорим серверу что у нас полная комната
                    IO.socket.emit('hostRoomFull', App.gameId);
                }
            },

            /**
             таймер отсчета
             */
            gameCountdown: function () {


                App.$gameArea.html(App.$hostGame);
                App.doTextFit('#hostWord');

                // таймер
                var $secondsLeft = $('#hostWord');
                App.countDown($secondsLeft, 5, function () {
                    IO.socket.emit('hostCountdownFinished', App.gameId);
                });

                // имена игроков на экране
                $('#player1Score')
                    .find('.playerName')
                    .html(App.Host.players[0].playerName);

                $('#player2Score')
                    .find('.playerName')
                    .html(App.Host.players[1].playerName);

                // ставим 0 очков для игроков
                $('#player1Score').find('.score').attr('id', App.Host.players[0].mySocketId);
                $('#player2Score').find('.score').attr('id', App.Host.players[1].mySocketId);
            },

            /**
             показывает новое слово
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord: function (data) {
                // вставляем новое слово в дерево DOM
                $('#hostWord').text(data.word);
                App.doTextFit('#hostWord');

                // обновляем данные раунда
                App.Host.currentCorrectAnswer = data.answer;
                App.Host.currentRound = data.round;
            },

            /**
             * проверяем ответ игрока
             * @param data{{round: *, playerId: *, answer: *, gameId: *}}
             */
            checkAnswer: function (data) {
                // проверяем является ли это ответом для текущего раунда
                // это не дает ошибок когда у человека не прогрузилось что то или зависло
                if (data.round === App.currentRound) {

                    // получаем счет игрока
                    var $pScore = $('#' + data.playerId);

                    // увеличиваем если правильно
                    if (App.Host.currentCorrectAnswer === data.answer) {
                        // +5
                        $pScore.text(+$pScore.text() + 5);

                        // увеличиваем раунд
                        App.currentRound += 1;

                        // пакуем данные для сервера
                        var data = {
                            gameId: App.gameId,
                            round: App.currentRound
                        }

                        // стартуем некст раунд
                        IO.socket.emit('hostNextRound', data);

                    } else {
                        // неправильный ответ
                        $pScore.text(+$pScore.text() - 3);
                    }
                }
            },


            /**
             * по прошествии 10 раундов заканчиваем игру
             * @param data
             */
            endGame: function (data) {
                //данные игрока 1 
                var $p1 = $('#player1Score');
                var p1Score = +$p1.find('.score').text();
                var p1Name = $p1.find('.playerName').text();

                // данные игрока 2
                var $p2 = $('#player2Score');
                var p2Score = +$p2.find('.score').text();
                var p2Name = $p2.find('.playerName').text();

                // смотрим победителя
                var winner = (p1Score < p2Score) ? p2Name : p1Name;
                var tie = (p1Score === p2Score);

                // выводим ничью или победителя
                if (tie) {
                    $('#hostWord').text("It's a Tie!");
                } else {
                    $('#hostWord').text(winner + ' Wins!!');
                }
                App.doTextFit('#hostWord');

                // обновялем игровые данные
                App.Host.numPlayersInRoom = 0;
                App.Host.isNewGame = true;
            },

            /**
             игроки нажимают заново
             */
            restartGame: function () {
                App.$gameArea.html(App.$templateNewGame);
                $('#spanNewGameCode').text(App.gameId);
            }
        },


        /* логика для игрока */

        Player: {

            /*сокет хоста
             */
            hostSocketId: '',

            /**
            ник
             */
            myName: '',

            /**
             обработчик кнопки присоединитсья
             */
            onJoinClick: function () {
                console.log('Clicked "Join A Game"');

                //прогружаем шаблон
                App.$gameArea.html(App.$templateJoinGame);
            },

            /**
            игрок ввел имя и id комнаты
             */
            onPlayerStartClick: function () {
                console.log('Player clicked "Start"');

                // пакуем данные
                var data = {
                    gameId: +($('#inputGameId').val()),
                    playerName: $('#inputPlayerName').val() || 'anon'
                };

                // отправляем на сервер
                IO.socket.emit('playerJoinGame', data);


                App.myRole = 'Player';
                App.Player.myName = data.playerName;
            },

            /**
             обработчик нажатия на ответ
             */
            onPlayerAnswerClick: function () {
                console.log('Clicked Answer Button');
                var $btn = $(this);      // нажатая кнопка
                var answer = $btn.val(); // нажатый ответ

                // отслыаем информацию об игроке и данном ответе
                var data = {
                    gameId: App.gameId,
                    playerId: App.mySocketId,
                    answer: answer,
                    round: App.currentRound
                }
                IO.socket.emit('playerAnswer', data);
            },

            /**
             обработчик начать заново
             */
            onPlayerRestart: function () {
                var data = {
                    gameId: App.gameId,
                    playerName: App.Player.myName
                }
                IO.socket.emit('playerRestart', data);
                App.currentRound = 0;
                $('#gameArea').html("<h3>Waiting on host to start new game.</h3>");
            },

            /**
             экран ожидания 
             * @param data
             */
            updateWaitingScreen: function (data) {
                if (IO.socket.socket.sessionid === data.mySocketId) {
                    App.myRole = 'Player';
                    App.gameId = data.gameId;

                    $('#playerWaitingMessage')
                        .append('<p/>')
                        .text('Joined Game ' + data.gameId + '. Please wait for game to begin.');
                }
            },

            /**
             приготовиться! при отсчете
             * @param hostData
             */
            gameCountdown: function (hostData) {
                App.Player.hostSocketId = hostData.mySocketId;
                $('#gameArea')
                    .html('<div class="gameOver">Get Ready!</div>');
            },

            /**
            список слов для текущего раунда
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord: function (data) {

                var $list = $('<ul/>').attr('id', 'ulAnswers');


                $.each(data.list, function () {
                    $list                                //  <ul> </ul>
                        .append($('<li/>')              //  <ul> <li> </li> </ul>
                            .append($('<button/>')      //  <ul> <li> <button> </button> </li> </ul>
                                .addClass('btnAnswer')   //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .addClass('btn')         //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .val(this)               //  <ul> <li> <button class='btnAnswer' value='word'> </button> </li> </ul>
                                .html(this)              //  <ul> <li> <button class='btnAnswer' value='word'>word</button> </li> </ul>
                            )
                        )
                });


                $('#gameArea').html($list);
            },

            /**
             игра окончена
             */
            endGame: function () {
                $('#gameArea')
                    .html('<div class="gameOver">Game Over!</div>')
                    .append(
                        // кнопка для начать заново
                        $('<button>Start Again</button>')
                            .attr('id', 'btnPlayerRestart')
                            .addClass('btn')
                            .addClass('btnGameOver')
                    );
            }
        },


        /* прочее */

        /**
        таймер для экрана хоста
         *
         * @param $el контейнер для таймера
         * @param startTime
         * @param callback вызвывем при конце таймера
         */
        countDown: function ($el, startTime, callback) {


            $el.text(startTime);
            App.doTextFit('#hostWord');

            console.log('Starting Countdown...');


            var timer = setInterval(countItDown, 1000);

            // уменьшаем таймер
            function countItDown() {
                startTime -= 1
                $el.text(startTime);
                App.doTextFit('#hostWord');

                if (startTime <= 0) {
                    console.log('Countdown Finished.');


                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        },

        /**
        для размеров текста(макс возможный)
         *
         * @param el родительский элемент текста
         */
        doTextFit: function (el) {
            textFit(
                $(el)[0],
                {
                    alignHoriz: true,
                    alignVert: false,
                    widthOnly: true,
                    reProcess: true,
                    maxFontSize: 300
                }
            );
        }

    };

    IO.init();
    App.init();

}($));
