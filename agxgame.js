var io;
var gameSocket;

/**
 * вызывается из index.js для инициализации новой игры.
 *
 * @param sio socket io библиотека
 * @param socket объект сокета для подключенного клиента.
 */
exports.initGame = function (sio, socket) {
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "connected!" });

    // события хоста
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // события игрока
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);
}

/* 

ФУНКЦИИ ХОСТА

*/

/**
 * нажатие кнопки начать- событие hostCreateNewGame.
 */
function hostCreateNewGame() {
    // случайный id для комнаты socket io
    var thisGameId = (Math.random() * 100000) | 0;

    // возвращает id комнаты (gameId) и id сокета (mySocketId) браузерному клиенту
    this.emit('newGameCreated', { gameId: thisGameId, mySocketId: this.id });

    // подключение к комнате и ожидание игроков
    this.join(thisGameId.toString());
};

/*
 * когда два игрока зашли преупреждаем хоста
 * @param gameId id комнаты
 */
function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId: sock.id,
        gameId: gameId
    };
    console.log("All Players Present. Preparing game...");
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

/*
 * по завершении отсчета игра начинается
 * @param gameId id комнаты
 */
function hostStartGame(gameId) {
    console.log('Game Started.');
    sendWord(0, gameId);
};

/**
 * игрок ответил правильно-следующий раунд
 * @param data прилетает от клиента. содержит текущий раунд и gameid
 */
function hostNextRound(data) {
    if (data.round < wordPool.length) {
        // отправляет новый набор слов хосту и игрокам.
        sendWord(data.round, data.gameId);
    } else {
        // If the current round exceeds the number of words, send the 'gameOver' event.
        io.sockets.in(data.gameId).emit('gameOver', data);
    }
}
/* ФУНКЦИИ ИГРОКА */

/**
 * игрок нажал начать игру
 * подключение к комнате
 * gameid вводится игроком
 * @param data содержит playerName и gameid
 */
function playerJoinGame(data) {
    console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId);

    // socketio игрока
    var sock = this;

    // ищем id комнаты
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // если комната существует
    if (room != undefined) {
        // socket id привязываем к data
        data.mySocketId = sock.id;

        // присоединяемся
        sock.join(data.gameId);

        console.log('Player ' + data.playerName + ' joining game: ' + data.gameId);

        // оповещение остальным
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // ошибка
        this.emit('error', { message: "This room does not exist." });
    }
}

/**
 * нажатие ответа
 * @param data gameId
 */
function playerAnswer(data) {
    console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);

    // ответ игрока привязан к data  \
    // событие проверки хостом ответа
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

/**
 * игроки нажали рестарт
 * @param data
 */
function playerRestart(data) {
    console.log('Player: ' + data.playerName + ' ready for new game.');

    // заново присоединяем к комнате
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
}

/* игровая логика */

/**
 * получаем слово для хоста и список для игроков
 *
 * @param wordPoolIndex
 * @param gameId 
 */
function sendWord(wordPoolIndex, gameId) {
    var data = getWordData(wordPoolIndex);
    io.sockets.in(gameId).emit('newWordData', data);
}

/**
 * получаем новые слова из данного и пакуем это все чтобы потом отправить
 *
 * @param i 
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(i) {
    // перемешиваем порядок доступных слов
    // первый элемент в перемеше всегда у хоста на экране
    // второй элемент лежит правильный в списке ответов
    var words = shuffle(wordPool[i].words);

    // перемешиваем порядок слов для ответа и берем первые 5
    var decoys = shuffle(wordPool[i].decoys).slice(0, 5);

    // вставялем в слуучайное место правильный ответ
    var rnd = Math.floor(Math.random() * 5);
    decoys.splice(rnd, 0, words[1]);

    // пакуем все в один объект
    var wordData = {
        round: i,
        word: words[0],   // выводимое слово
        answer: words[1], // правильный ответ
        list: decoys      // список для игроков
    };

    return wordData;
}

/*
перемешка
 */
function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;


    while (0 !== currentIndex) {


        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;


        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

/**
 * каждый элемент-раунд
 *
 * из слов выбирается слово хоста и правильный ответ
 * из decoys выбираем 5 случайных для показа
 * правильный ответ вставялется среди decoys
 *
 * @type {Array}
 */
var wordPool = [
    {
        "words": ["sale", "seal", "ales", "leas"],
        "decoys": ["lead", "lamp", "seed", "eels", "lean", "cels", "lyse", "sloe", "tels", "self"]
    },

    {
        "words": ["item", "time", "mite", "emit"],
        "decoys": ["neat", "team", "omit", "tame", "mate", "idem", "mile", "lime", "tire", "exit"]
    },

    {
        "words": ["spat", "past", "pats", "taps"],
        "decoys": ["pots", "laps", "step", "lets", "pint", "atop", "tapa", "rapt", "swap", "yaps"]
    },

    {
        "words": ["nest", "sent", "nets", "tens"],
        "decoys": ["tend", "went", "lent", "teen", "neat", "ante", "tone", "newt", "vent", "elan"]
    },

    {
        "words": ["pale", "leap", "plea", "peal"],
        "decoys": ["sale", "pail", "play", "lips", "slip", "pile", "pleb", "pled", "help", "lope"]
    },

    {
        "words": ["races", "cares", "scare", "acres"],
        "decoys": ["crass", "scary", "seeds", "score", "screw", "cager", "clear", "recap", "trace", "cadre"]
    },

    {
        "words": ["bowel", "elbow", "below", "beowl"],
        "decoys": ["bowed", "bower", "robed", "probe", "roble", "bowls", "blows", "brawl", "bylaw", "ebola"]
    },

    {
        "words": ["dates", "stead", "sated", "adset"],
        "decoys": ["seats", "diety", "seeds", "today", "sited", "dotes", "tides", "duets", "deist", "diets"]
    },

    {
        "words": ["spear", "parse", "reaps", "pares"],
        "decoys": ["ramps", "tarps", "strep", "spore", "repos", "peris", "strap", "perms", "ropes", "super"]
    },

    {
        "words": ["stone", "tones", "steno", "onset"],
        "decoys": ["snout", "tongs", "stent", "tense", "terns", "santo", "stony", "toons", "snort", "stint"]
    }
]
