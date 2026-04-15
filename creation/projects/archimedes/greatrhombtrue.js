module.exports = () => {
  buildArchimedean([
    [1/PHI, 1/PHI, 3+PHI],
    [2/PHI, PHI, 1 + 2*PHI],
    [1/PHI, PHI*PHI, -1+3*PHI],
    [2*PHI-1, 2, 2+PHI],
    [PHI, 3, 2*PHI],
  ], {
    edgeLength: 4,
  })

  edgeCleanup()
  EulerianPath(0)
}
