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
    this._pdt = 0.0001;                 //The physics update delta time
    this._pdte = new Date().getTime();  //The physics update last delta time
    //A local timer for precision on server and client
    this.local_time = 0.016;            //The local timer
    this._dt = new Date().getTime();    //The local timer delta
    this._dte = new Date().getTime();   //The local timer last frame time

    this.create_physics_simulation();
    this.create_timer();

    //client and server initialisation
    if (!this.server) {
        this.client_create_configuration();
        this.server_updates = [];
        this.client_connect_to_server();
    }

};

/*
    Helper functions for the game code
        Here we have some common maths and game related code to make working with 2d vectors easy,
        as well as some helpers for rounding numbers to fixed point.
*/

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function (n) { n = n || 3; return parseFloat(this.toFixed(n)); };
//copies a 2d vector like object from one to another
game_core.prototype.pos = function (a) { return { x: a.x, y: a.y }; };
//Add a 2d vector with another one and return the resulting vector
game_core.prototype.v_add = function (a, b) { return { x: (a.x + b.x).fixed(), y: (a.y + b.y).fixed() }; };
//Subtract a 2d vector with another one and return the resulting vector
game_core.prototype.v_sub = function (a, b) { return { x: (a.x - b.x).fixed(), y: (a.y - b.y).fixed() }; };
//Multiply a 2d vector with a scalar value and return the resulting vector
game_core.prototype.v_mul_scalar = function (a, b) { return { x: (a.x * b).fixed(), y: (a.y * b).fixed() }; };
//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function () { window.cancelAnimationFrame(this.updateid); };
//Simple linear interpolation
game_core.prototype.lerp = function (p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); };
//Simple linear interpolation between 2 vectors
game_core.prototype.v_lerp = function (v, tv, t) { return { x: this.lerp(v.x, tv.x, t), y: this.lerp(v.y, tv.y, t) }; };


game_core.prototype.create_timer = function () {
    setInterval(function () {
        this._dt = new Date().getTime() - this._dte;
        this._dte = new Date().getTime();
        this.local_time += this._dt / 1000.0;
    }.bind(this), 4);
}

game_core.prototype.create_physics_simulation = function () {

    setInterval(function () {
        this._pdt = (new Date().getTime() - this._pdte) / 1000.0;
        this._pdte = new Date().getTime();
        this.update_physics();
    }.bind(this), 15);

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
    this.socket.on('onconnected', this.client_onconnected.bind(this));
};

game_core.prototype.client_onconnected = function() {
    //server responds that we are now in a game
    this.players.self.id = data.id;
    this.players.self.state = 'connected';
    this.players.self.online = true;
}

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

game_core.prototype.client_process_net_prediction_correction = function () {
    if (!this.server_updates.length) return;

    var latest_server_data = this.server_updates[this.server_updates.length - 1];

    var my_server_pos = this.players.self.host ? latest_server_data.hp : latest_server_data.cp;

    var my_last_input_on_server = this.players.self.host ? latest_server_data.his : latest_server_data.cis;

    if (my_last_input_on_server) {
        var lastinputseq_index = -1;

        for (var i = 0; i < this.players.self.inputs.length; ++i) {
            if (this.players.self.inputs[i].seq == my_last_input_on_server) {
                lastinputseq_index = i;
                break;
            }
        }

        if (lastinputseq_index != -1) {
            var number_to_clear = Math.abs(lastinputseq_index - (-1));
            this.players.self.inputs.splice(0, number_to_clear);
            //The player is now located at the new server position, authoritive server
            this.players.self.cur_state.pos = this.pos(my_server_pos);
            this.players.self.last_input_seq = lastinputseq_index;
            //Now we reapply all the inputs that we have locally that
            //the server hasn't yet confirmed. This will 'keep' our position the same,
            //but also confirm the server position at the same time.
            this.client_update_physics();
            this.client_update_local_position();
        }
    }
};

game_core.prototype.client_update_local_position = function () {
    if (this.client_predict) {
        //Work out the time we have since we updated the state
        var t = (this.local_time - this.players.self.state_time) / this._pdt;

        //Then store the states for clarity,
        var old_state = this.players.self.old_state.pos;
        var current_state = this.players.self.cur_state.pos;

        //Make sure the visual position matches the states we have stored
        //this.players.self.pos = this.v_add( old_state, this.v_mul_scalar( this.v_sub(current_state,old_state), t )  );
        this.players.self.pos = current_state;

        //We handle collision on client if predicting.
        this.check_collision(this.players.self);
    }
};

game_core.prototype.client_update_physics = function () {

    //Fetch the new direction from the input buffer,
    //and apply it to the state so we can smooth it in the visual state

    if (this.client_predict) {

        this.players.self.old_state.pos = this.pos(this.players.self.cur_state.pos);
        var nd = this.process_input(this.players.self);
        this.players.self.cur_state.pos = this.v_add(this.players.self.old_state.pos, nd);
        this.players.self.state_time = this.local_time;

    }

};

game_core.prototype.process_input = function (player) {
    //It's possible to have recieved multiple inputs by now,
    //so we process each one
    var x_dir = 0;
    var y_dir = 0;
    var ic = player.inputs.length;
    if (ic) {
        for (var j = 0; j < ic; ++j) {
            //don't process ones we already have simulated locally
            if (player.inputs[j].seq <= player.last_input_seq) continue;

            var input = player.inputs[j].inputs;
            var c = input.length;
            for (var i = 0; i < c; ++i) {
                var key = input[i];
                if (key == 'l') {
                    x_dir -= 1;
                }
                if (key == 'r') {
                    x_dir += 1;
                }
                if (key == 'd') {
                    y_dir += 1;
                }
                if (key == 'u') {
                    y_dir -= 1;
                }
            } //for all input values

        } //for each input command
    } //if we have inputs

    //we have a direction vector now, so apply the same physics as the client
    var resulting_vector = this.physics_movement_vector_from_direction(x_dir, y_dir);
    if (player.inputs.length) {
        //we can now clear the array since these have been processed

        player.last_input_time = player.inputs[ic - 1].time;
        player.last_input_seq = player.inputs[ic - 1].seq;
    }

    //give it back
    return resulting_vector;
};

game_core.prototype.physics_movement_vector_from_direction = function (x, y) {

    //Must be fixed step, at physics sync speed.
    return {
        x: (x * (this.playerspeed * 0.015)).fixed(3),
        y: (y * (this.playerspeed * 0.015)).fixed(3)
    };

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