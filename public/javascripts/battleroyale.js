var game_core = function(game_instance) {
    this.instance = game_instance;
    this.server = this.instance !== undefined;

    this.world = {
        width : 1000,
        height : 800
    };

    if (this.server) {
        this.players = {
            self : new game_player(this, this.instance.player_host),
            other : new game_player(this, this.instance.player_client)
        };
        this.players.self.pos = {x:20,y:20}; //starting position
    }
    else {
        this.players = {
            self : new game_player(this),
            other : new game_player(this)
        }
    }

    this.playerspeed = 120; //speed that players move

    //physics integration values:

    //client and server initialisation
    if(!this.server) {
        this.server_updates = [];
        this.client_connect_to_server();
    }
    
}

game_core.prototype.client_connect_to_server = function() {
    this.socket = io.connect();

    this.socket.on('connect', function() {
        this.players.self.state = 'connecting';
    }.bind(this));

    this.socket.on('disconnect', this.client_ondisconnect.bind(this));
}

var game_player = function(game_instance, player_instance) {
    this.instance = player_instance;
    this.game = game_instance;

    this.pos = {x:0, y:0};
    this.size = {x:16, y:16, hx:8, hy: 8};
    this.color = 'rgb(255,255,255)';
    this.state = 'not-connected';
    this.id = '';

    this.old_state = {pos : {x:0, y:0}};
    this.current_state = {pos : {x:0, y:0}};
    this.state_time = new Date().getTime();

    //local input history
    this.inputs = [];

    this.pos_limits = {
        x_min: this.size.hx,
        x_max: this.game.world.width - this.size.hx,
        y_min: this.size.hy,
        y_max: this.game.world.height - this.size.hy
    };

    if(player_instance) {
        this.pos = {x:20, y:20};
    }
    else {
        this.pos = {x:800, y:250};
    }
}