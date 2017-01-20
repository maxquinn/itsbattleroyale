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
    // Make it visually fill the positioned parent
    canvas.style.width = '100%';
    canvas.style.height = canvas.scrollWidth;
    // ...then set the internal size to match
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}