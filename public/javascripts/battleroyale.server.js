var game_server = module.exports = { games: {}, numberOfGames: 0 };
var UUID = require('node-uuid');

global.window = global.document = global;

require('./battleroyale.js');

game_server.log = function () {
    console.log.apply(this, arguments);
}

game_server.local_time = 0;
game_server._dt = new Date().getTime();
game_server._dte = new Date().getTime();
//a local queue of messages we delay if faking latency
game_server.messages = [];

setInterval(function () {
    game_server._dt = new Date().getTime() - game_server._dte;
    game_server._dte = new Date().getTime();
    game_server.local_time += game_server._dt / 1000.0;
}, 4);

game_server.onMessage = function (client, message) {
    game_server._onMessage(client, message);
};

game_server._onMessage = function (client, message) {
    //Cut the message up into sub components
    var message_parts = message.split('.');
    //The first is always the type of message
    var message_type = message_parts[0];

    var other_client =
        (client.game.player_host.userid == client.userid) ?
            client.game.player_client : client.game.player_host;

    if (message_type == 'i') {
        //Input handler will forward this
        this.onInput(client, message_parts);
    } else if (message_type == 'p') {
        client.send('s.p.' + message_parts[1]);
    } else if (message_type == 'c') {    //Client changed their color!
        if (other_client)
            other_client.send('s.c.' + message_parts[1]);
    } else if (message_type == 'l') {    //A client is asking for lag simulation
        this.fake_latency = parseFloat(message_parts[1]);
    }
};

game_server.onInput = function (client, parts) {
    //The input commands come in like u-l,
    //so we split them up into separate commands,
    //and then update the players
    var input_commands = parts[1].split('-');
    var input_time = parts[2].replace('-', '.');
    var input_seq = parts[3];

    //the client should be in a game, so
    //we can tell that game to handle the input
    if (client && client.game && client.game.gamecore) {
        client.game.gamecore.handle_server_input(client, input_commands, input_time, input_seq);
    }

};

game_server.findGame = function (player) {
    this.log('Looking for a game to join. Currently there are: ' + this.numberOfGames + ' games available.');

    if (this.numberOfGames) {
        var joinedAGame = false;


        //check current games list for an open game
        for (var gameID in this.games) {
            if (!this.games.hasOwnProperty(gameID)) continue;

            var game_instance = this.games[gameID];

            if (game_instance.player_count < 2) {
                joinedAGame = true;

                game_instance.player_client = player;
                game_instance.gamecore.players.other.instance = player;
                game_instance.player_count++;

                this.startGame(game_instance);
            }
        }
        if (!joined_a_game) {
            this.createGame(player);
        }
    }
    else {
        this.createGame(player);
    }
};

game_server.createGame = function (player) {
    //create new game
    this.log('Created a new game for ' + player);

    var newGame = {
        id: UUID(),
        player_host: player,
        player_client: null,
        player_count: 1
    };

    this.games[newGame.id] = newGame; //store game in games list
    this.numberOfGames++;

    newGame.gamecore = new game_core(newGame); //create new game instance - function is located in battleroyale.js
    newGame.gamecore.update(new Date().getTime());

    //tell the player that they are now the host
    //s=server message, h=you are hosting

    player.send('s.h.' + String(newGame.gamecore.local_time).replace('.', '-'));
    console.log('server host at  ' + newGame.gamecore.local_time);
    player.game = newGame;
    player.hosting = true;

    this.log('player ' + player.userid + ' created a game with id ' + player.game.id);

    //return it
    return newGame;
};

game_server.endGame = function (gameid, userid) {

    var thegame = this.games[gameid];

    if (thegame) {

        //stop the game updates immediate
        thegame.gamecore.stop_update();

        //if the game has two players, the one is leaving
        if (thegame.player_count > 1) {

            //send the players the message the game is ending
            if (userid == thegame.player_host.userid) {

                //the host left, oh snap. Lets try join another game
                if (thegame.player_client) {
                    //tell them the game is over
                    thegame.player_client.send('s.e');
                    //now look for/create a new game.
                    this.findGame(thegame.player_client);
                }

            } else {
                //the other player left, we were hosting
                if (thegame.player_host) {
                    //tell the client the game is ended
                    thegame.player_host.send('s.e');
                    //i am no longer hosting, this game is going down
                    thegame.player_host.hosting = false;
                    //now look for/create a new game.
                    this.findGame(thegame.player_host);
                }
            }
        }

        delete this.games[gameid];
        this.game_count--;

        this.log('game removed. there are now ' + this.game_count + ' games');

    } else {
        this.log('that game was not found!');
    }

};

game_server.startGame = function (game) {
    game.player_client.send('s.j.' + game.player_host.userid);
    game.player_client.game = game;

    //now we tell both that the game is ready to start
    //clients will reset their positions in this case.
    game.player_client.send('s.r.' + String(game.gamecore.local_time).replace('.', '-'));
    game.player_host.send('s.r.' + String(game.gamecore.local_time).replace('.', '-'));

    //set this flag, so that the update loop can run it.
    game.active = true;

};