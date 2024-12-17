module.exports = () => {
  MAX_WALL_LENGTH = 10000
  console.log(1524 - 91 * PIXEL_DISTANCE, 1016 - 60* PIXEL_DISTANCE)

  addPolygon(4, [0,0,0], [91, 60])
  EulerianPath(1)
}
