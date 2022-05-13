var data, camera, scene, renderer, group, pixels, ws, lastUpdate, raw_pixels;

fetch("/pixels.json").then(function(response){
  return response.json()
}).then(function(json){
  data = json
  init();
  startWebsocket()
  animate();
})

function clamp(num, min, max){
  return Math.min(Math.max(num, min), max);
} 

function init() {

  group = new THREE.Group();
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 17;
  scene.add(camera);
  var points = [];
  pixels = [];
  for (var point of data.coordinates) {
    var cgeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    cgeometry.translate(point[0], point[1], point[2])
    var cmaterial = new THREE.MeshBasicMaterial({
      color: 0x999999
    });
    var cube = new THREE.Mesh(cgeometry, cmaterial);
    pixels.push(cube)
    group.add(cube);
    points.push(new THREE.Vector3(point[0], point[1], point[2]));
  }
  var start = data.coordinates[0]
  points.push(new THREE.Vector3(start[0], start[1], start[2]))
  var material = new THREE.LineBasicMaterial({
    color: 0x0000ff,
  });
  var geometry = new THREE.BufferGeometry().setFromPoints(points);
  var line = new THREE.Line(geometry, material);
  group.add(line);

  var cygeometry = new THREE.CylinderGeometry( 0.75, 0.75, 1.5, 32 );
  cygeometry.rotateX(Math.PI/2)
  cygeometry.translate(0,0,-5);
  var cymaterial = new THREE.MeshBasicMaterial( {color: 0x000044} );
  var cylinder = new THREE.Mesh( cygeometry, cymaterial );
  group.add( cylinder );

  var sgeometry = new THREE.SphereGeometry( 4.25, 32, 16 );
  var smaterial = new THREE.MeshBasicMaterial( { color: 0x000000 } );
  var sphere = new THREE.Mesh( sgeometry, smaterial );
  smaterial.transparent = true;
  smaterial.opacity = 0.7;
  group.add( sphere );

  scene.add(group);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth-20, window.innerHeight-20);

  document.body.appendChild(renderer.domElement);

}

function animate() {

  requestAnimationFrame(animate);
  render();

}

function render() {
  group.rotation.set(clamp(yOffset/200,-0.65,0.65)-Math.PI/2,0,xOffset/200);
  if(raw_pixels){
    var rp = pako.inflate(raw_pixels, {to:'string'})
    for(let i = 0; i < pixels.length; i++){
      var pixel = pixels[i]
      var j = i*6
      var color = `#${rp.slice(j+3,j+4)}${rp.slice(j+1,j+2)}${rp.slice(j+5,j+6)}`
      pixel.material.color.set(color)
    }
  }
  renderer.render(scene, camera);
}

var active = false;
var currentX;
var currentY;
var initialX;
var initialY;
var xOffset = 0;
var yOffset = 0;


document.addEventListener("mousedown", dragStart, false);
document.addEventListener("mouseup", dragEnd, false);
document.addEventListener("mousemove", drag, false);
document.addEventListener("wheel", wheel, true);

function dragStart(e) {
  if (e.type === "touchstart") {
    initialX = e.touches[0].clientX - xOffset;
    initialY = e.touches[0].clientY - yOffset;
  } else {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
  }

  active = true;
}

function dragEnd(e) {
  initialX = currentX;
  initialY = currentY;

  active = false;
}

function drag(e) {
  if (active) {

    e.preventDefault();

    if (e.type === "touchmove") {
      currentX = e.touches[0].clientX - initialX;
      currentY = e.touches[0].clientY - initialY;
    } else {
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
    }

    xOffset = currentX;
    yOffset = currentY;

  }
}

function wheel(e) {
  e.preventDefault();
  camera.position.z = clamp(camera.position.z + e.deltaY * 0.02, 8, 100)
}

function startWebsocket() {
  if(ws) {
    return // Already trying to establish a connection
  }
  ws = new WebSocket(`ws://${window.location.hostname}:8888`)
  ws.binaryType = "arraybuffer"
  ws.onmessage = event => {
    var t = Date.now()
    if(lastUpdate){
      var dt = t - lastUpdate
      //console.log(1/(dt/1000))
    }
    lastUpdate = t
    raw_pixels = event.data
  }
  ws.onclose = event => {
    console.log("CLOSE")
    ws = null
  }
  ws.onerror = event => {
    console.error("ERROR",event)
    ws = null
  }
}

