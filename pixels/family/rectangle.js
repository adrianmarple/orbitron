
addButton("Rectangle", () => {
  name = "mieke"
  setLaserParams({
    BORDER: 4,
    CHANNEL_WIDTH: 5,
    CHANNEL_DEPTH: 8,
    NOTCH_DEPTH: 3,
    PIXEL_DISTANCE: 8.333, //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  })
  
  addPolygon(4, [0,0,0], [60,90])
  console.log(verticies.length)
  
  EulerianPath(1)
})
