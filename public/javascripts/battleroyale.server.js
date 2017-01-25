var game_server = { games: {}, numberOfGames: 0 }
var UUID = require('node-uuid');

global.window = global.document = global;

require('./battleroyale.js');

game_server.log = function () {
    console.log.apply(this, arguments);
}

game_server.findGame = function (player) {
    this.log('Looking for a game to join. Currently there are: ' + this.numberOfGames + ' games available.');

    if (this.numberOfGames) {
        var joinedAGame = false;


        //check current games list for an open game
        for (var gameID in this.games) {
            if(!this.games.hasOwnProperty(gameID)) continue;

            var game_instance = this.games[gameID];

            if(game_instance.player_count < 2) {
                joinedAGame = true;

                game_instance.player_client = player;
                game_instance.gamecore.players.other.instance = player;
                game_instance.player_count++;

                this.startGame(game_instance);
            }
        }
    }
    else {
        this.createGame(player);
    }
}

game_server.createGame = function(player) {
    //create new game
    this.log('Created a new game for ' + player);

    var newGame = {
        id : UUID(),
        player_host : player,
        player_client : null,
        player_count : 1
    };

    this.games[newGame.id] = newGame; //store game in games list
    this.numberOfGames++;

    newGame.gamecore = new game_core(newGame); //create new game instance - function is located in battleroyale.js
}

game_server.startGame = function(game) {
    console.log('game started');
}