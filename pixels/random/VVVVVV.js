
addButton("VVVVVV", () => {
  name = "VVVVVV"
  // setLaserParams({
  //   BORDER: 4,
  //   CHANNEL_WIDTH: 5,
  //   CHANNEL_DEPTH: 8,
  //   NOTCH_DEPTH: 3,
  //   PIXEL_DISTANCE: 8.333, //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  // })
  setLaserParams({
    NOTCH_DEPTH: 4,
    BORDER: 5,
  })
  ledAtVertex = false

  let v0 = addVertex([0,0,0])
  for (let i = 1; i <= 6; i++) {
    let v1 = addVertex([i * 7, 0, 0])
    addSquareulation(v0, v1, 37, 1)
    v0 = v1
  }

  center()

  EulerianPath(17)
})
