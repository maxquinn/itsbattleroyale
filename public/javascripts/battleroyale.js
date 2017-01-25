var game_core = function (game_instance) {
    this.instance = game_instance;
    this.server = this.instance !== undefined;

    this.world = {
        width: 1000,
        height: 800
    };

    if (this.server) {
        this.players = {
            self: new game_player(this, this.instance.player_host),
            other: new game_player(this, this.instance.player_client)
        };
        this.players.self.pos = { x: 20, y: 20 }; //starting position
    }
    else {
        this.players = {
            self: new game_player(this),
            other: new game_player(this)
        }
    }

    this.playerspeed = 120; //speed that players move

    //physics integration values:

    //client and server initialisation
    if (!this.server) {
        this.client_create_configuration();
        this.server_updates = [];
        this.client_connect_to_server();
    }

};

game_core.prototype.client_create_configuration = function () {

    this.show_help = false;             //Whether or not to draw the help text
    this.show_server_pos = false;       //Whether or not to show the server position
    this.show_dest_pos = false;         //Whether or not to show the interpolation goal
    this.client_predict = true;         //Whether or not the client is predicting input
    this.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number
    this.client_smoothing = true;       //Whether or not the client side prediction tries to smooth things out
    this.client_smooth = 25;            //amount of smoothing to apply to client update dest

    this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
    this.net_ping = 0.001;              //The round trip time from here to the server,and back
    this.last_ping_time = 0.001;        //The time we last sent a ping
    this.fake_lag = 0;                  //If we are simulating lag, this applies only to the input client (not others)
    this.fake_lag_time = 0;

    this.net_offset = 100;              //100 ms latency between server and client interpolation for other clients
    this.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
    this.target_time = 0.01;            //the time where we want to be in the server timeline
    this.oldest_tick = 0.01;            //the last time tick we have available in the buffer

    this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
    this.server_time = 0.01;            //The time the server reported it was at, last we heard from it

    this.dt = 0.016;                    //The time that the last frame took to run
    this.fps = 0;                       //The current instantaneous fps (1/this.dt)
    this.fps_avg_count = 0;             //The number of samples we have taken for fps_avg
    this.fps_avg = 0;                   //The current average fps displayed in the debug UI
    this.fps_avg_acc = 0;               //The accumulation of the last avgcount fps samples

    this.lit = 0;
    this.llt = new Date().getTime();

};

game_core.prototype.client_connect_to_server = function () {
    this.socket = io.connect();

    this.socket.on('connect', function () {
        this.players.self.state = 'connecting';
    }.bind(this));

    this.socket.on('disconnect', this.client_ondisconnect.bind(this));
    this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
};

game_core.prototype.client_ondisconnect = function (data) {
    this.players.self.state = 'not-connected';
    this.players.self.online = false;

    this.players.other.state = 'not-connected';

};

game_core.prototype.client_onserverupdate_recieved = function (data) {
    var player_host = this.players.self.host ? this.players.self : this.players.other;
    var player_client = this.players.self.host ? this.players.other : this.players.self;
    var this_player = this.players.self;

    this.server_time = data.t;
    this.client_time = this.server_time - (this.net_offset / 1000);

    this.server_updates.push(data);
    if (this.server_updates.length >= (60 * this.buffer_size)) {
        this.server_updates.splice(0, 1);
    }

    this.oldest_tick = this.server_updates[0].t;

    this.client_process_net_prediction_correction();
};

game_core.prototype.client_process_net_prediction_correction = function() {
    if(!this.server_updates.length) return;
};

var game_player = function (game_instance, player_instance) {
    this.instance = player_instance;
    this.game = game_instance;

    this.pos = { x: 0, y: 0 };
    this.size = { x: 16, y: 16, hx: 8, hy: 8 };
    this.color = 'rgb(255,255,255)';
    this.state = 'not-connected';
    this.id = '';

    this.old_state = { pos: { x: 0, y: 0 } };
    this.current_state = { pos: { x: 0, y: 0 } };
    this.state_time = new Date().getTime();

    //local input history
    this.inputs = [];

    this.pos_limits = {
        x_min: this.size.hx,
        x_max: this.game.world.width - this.size.hx,
        y_min: this.size.hy,
        y_max: this.game.world.height - this.size.hy
    };

    if (player_instance) {
        this.pos = { x: 20, y: 20 };
    }
    else {
        this.pos = { x: 800, y: 250 };
    }
}