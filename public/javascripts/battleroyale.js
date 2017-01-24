//Constants
var socket = io.connect('/'),
    canvasWidth = 1000,
    canvasHeight = 800;


canvasContainer = document.getElementById('canvascontainer');
canvas = document.createElement('canvas');
canvas.id = "myCanvas";
canvasContainer.appendChild(canvas);
fitToContainer(canvas);

//////////////////Get Canvas Context/////////////////
cC = canvas.getContext("2d");///////////////////////
cC.moveTo(0, 0);///////////////////////////////////
cC.clearRect(0, 0, canvas.width, canvas.height);//
/////////////////////////////////////////////////

cC.fillStyle = '#000000';
cC.fillRect(0, 0, 100, 100);
canvas.style.border = '1px solid #000';

function fitToContainer(canvas) {
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}

socket.on('onconnected', function (data) {
    console.log('Connected successfully to the socket.io server. My server side ID is ' + data.id);
});