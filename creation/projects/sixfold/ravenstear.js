//v1.0.1
module.exports = () => {
  BORDER = 6
  portPartID = "1L"
  PORT_POSITION = "fold"
  

  let dodecEdges = addDodecagon([0,0,0], 5)
  let nextVerticies = []
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    nextVerticies.push(addTriangulation(edge.verticies[0], edge.verticies[1], 3))
  }

  let nextNextVerticies = []
  for (let i = 0; i < 12; i++) {
    let v0 = nextVerticies[i]
    let v1 = nextVerticies[(i+1)%12]
    nextNextVerticies.push(addTriangulation(v0, v1, 4))
  }

  for (let i = 0; i < 12; i++) {
    let v0 = nextNextVerticies[i]
    let v1 = nextNextVerticies[(i+1)%12]
    addTriangulation(v0, v1, 7)
  }

  let edgesToRemove = [
    0,1,11,12,13,14,35,59,36,
    16,38,60,62,40,64,81,57,79,77,55,33
  ]
  edgesToRemove = edgesToRemove.sort((a,b)=>b-a)
  for (let edgeIndex of edgesToRemove) {
    removeEdge(edgeIndex)
  }

  // Replace "pinions"
  edgesToRemove = [
    10,28,45,29,46,47,
    58,42,59,25,43,60,
  ]
  edgesToRemove = edgesToRemove.sort((a,b)=>b-a)
  for (let edgeIndex of edgesToRemove) {
    removeEdge(edgeIndex)
  }
  addLine(1, 14-2, -90)
  addLine(11, 11-2, -60)
  addLine(20, 7-2, -30)
  addLine(8, 14-2, -90)
  addLine(17, 11-2, -120)
  addLine(25, 7-2, -150)

  // Replace "tear" top bit
  edgesToRemove = [
    0,9,25,50,49,38,24,8,
  ]
  edgesToRemove = edgesToRemove.sort((a,b)=>b-a)
  for (let edgeIndex of edgesToRemove) {
    removeEdge(edgeIndex)
  }
  addTriangulation(7,0, 19)

  // The 3 unit legs around the dodecagon are shorter than ZERO_FOLD_LENGTH_THRESHOLD, so
  // zeroFoldAllEdges merges the whole crown into one 436x327mm cover. Seam it back apart at
  // the six interior dodecagon points instead; each side keeps one crown triangle.
  zeroFoldAllEdges()

  // Before EulerianPath, so edgeCleanup halves the dodecagon edges. That gives every half-edge
  // exactly one fold end, which is the only shape wall.left/wall.right can express, and lets the
  // fold wall span the seam as one part instead of stopping dead at it.
  for (let i = 1; i <= 6; i++) {
    vertexZeroFold(i, [i-1, 7+i])
  }

  EulerianPath(26, 0)


  dataPostProcessingFunction = info => {
    let deadends = []
    for (let i = 0; i < info.neighbors.length; i++) {
      if (info.neighbors[i].length == 1) {
        deadends.push(i)
      }
    }

    deadends = deadends.sort((i, j) => {
      return info.coords[i].y - info.coords[j].y
    })
    connectPixels(info, deadends.pop(), deadends.pop())
    connectPixels(info, deadends.pop(), deadends.pop())
    connectPixels(info, deadends.pop(), deadends.pop())
  }


  // ---- Conform the assembled covers to the ravenstear logo ----
  // The covers are generated with a uniform BORDER offset; this pulls every point that sits on
  // the outline of the assembled web onto the nearest point of scad/ravenstear.svg, scaled so
  // the logo's top and bottom land on the covers' top and bottom before any of this runs.

  const LOGO_URL = "http://localhost:8000/scad/ravenstear.svg"
  const LOGO_SPACING = 2       // mm between resampled outline points, so snapping tracks the logo
  const LOGO_MAX_TRAVEL = 60   // mm a point may move; past this it is left where it was
  const LOGO_INSIDE_TRAVEL = 12 // ...but a point the logo already covers may only move this far
  const LOGO_MAX_INSERT = 4    // logo verticies insertable between two snapped points
  const LOGO_TIP_RADIUS = 30   // mm from a design tip within which a corner is pinned to its
                               // matching logo tip
  const LOGO_TIP_ANGLE = 0.3   // radians a logo tip may sit away from a design tip to match it
  const LOGO_TIP_BEHIND = 5    // mm a point may sit behind a tip and still count as part of it

  let logo = null // logo outline, as closed polygons in cover space
  let tips = null // design tip -> logo tip pairing

  function parseLogo(text, bounds) {
    let doc = new DOMParser().parseFromString(text, "image/svg+xml")
    let rings = []
    for (let element of doc.querySelectorAll("path")) {
      let d = element.getAttribute("d")
      if (/[^MLHVZ\d\s.,-]/.test(d)) {
        console.error("ravenstear.svg uses path commands this parser doesn't handle", d)
      }
      let ring = null
      let x = 0
      let y = 0
      for (let match of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
        let command = match[1]
        let numbers = match[2].trim().split(/[\s,]+/).filter(s => s.length > 0).map(parseFloat)
        if (command == "Z") {
          ring = null
          continue
        }
        if (command == "M") {
          x = numbers.shift()
          y = numbers.shift()
          ring = [[x, y]]
          rings.push(ring)
        }
        if (!ring) continue
        while (numbers.length > 0) {
          if (command == "H") {
            x = numbers.shift()
          } else if (command == "V") {
            y = numbers.shift()
          } else {
            x = numbers.shift()
            y = numbers.shift()
          }
          ring.push([x, y])
        }
      }
    }

    let minX = 1e6
    let minY = 1e6
    let maxX = -1e6
    let maxY = -1e6
    for (let ring of rings) {
      // a closing point that repeats the start would snap onto itself forever
      let first = ring[0]
      let last = ring.last()
      if (epsilonEquals(first[0], last[0]) && epsilonEquals(first[1], last[1])) {
        ring.pop()
      }
      for (let [x, y] of ring) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    // Match the logo's height to the covers' height. SVG y runs downwards, cover y runs up.
    let scale = (bounds.maxY - bounds.minY) / (maxY - minY)
    let centerX = (bounds.minX + bounds.maxX) / 2
    let logoCenterX = (minX + maxX) / 2
    return rings.map(ring => ring.map(([x, y]) => new Vector(
      centerX + (x - logoCenterX) * scale,
      bounds.maxY - (y - minY) * scale,
      0,
    )))
  }

  function closestOnSegment(point, a, b) {
    let ab = b.sub(a)
    let lengthSquared = ab.dot(ab)
    let t = 0
    if (lengthSquared > 0) {
      t = Math.max(0, Math.min(1, point.sub(a).dot(ab) / lengthSquared))
    }
    return { point: a.addScaledVector(ab, t), t }
  }

  // Nearest-point snapping can't reach a tip: a spike contributes one mitre point sitting well
  // inside the logo's tip wedge, and the nearest logo edge is the side of the arm, not the
  // point. So pair each of the design's tips with the logo tip pointing the same way, by hand.
  function findTips(center) {
    let tips = []
    for (let vertex of verticies) {
      // doubleEdges() has already run by now, so every edge has a dupe alongside it
      let unique = vertex.edges.filter(edge => !edge.isDupe)
      let isTip = unique.length == 1
      if (unique.length == 2) {
        isTip = unique[0].toVector(vertex).angleTo(unique[1].toVector(vertex)) < Math.PI/2
      }
      if (!isTip) continue

      let at = vertex.ogCoords.scale(PIXEL_DISTANCE)
      // Which way the tip actually points, which is not the way it lies from the middle: the
      // vertical bars sit at 57 degrees but point straight up, and using the radial direction
      // there throws away one of the two corners of their end cap.
      let outward = ZERO
      for (let edge of unique) {
        outward = outward.sub(edge.toVector(vertex).normalize())
      }
      outward = outward.normalize()
      let radial = at.sub(center)
      let best = null
      for (let r = 0; r < logo.length; r++) {
        for (let i = 0; i < logo[r].length; i++) {
          let candidate = logo[r][i].sub(center)
          if (candidate.length() < radial.length()) continue
          if (candidate.angleTo(radial) > LOGO_TIP_ANGLE) continue
          if (!best || candidate.length() > best.reach) {
            best = {
              at,
              outward,
              point: logo[r][i],
              ring: r,
              segment: i,
              reach: candidate.length(),
            }
          }
        }
      }
      if (best) tips.push(best)
    }
    return tips
  }

  function logoTipNear(point) {
    for (let tip of tips) {
      if (tip.at.distanceTo(point) > LOGO_TIP_RADIUS) continue
      // Only the outward side of the tip belongs to it. The tear's apex has the hole's own
      // corner sitting just behind it, and dragging that onto the tip's edges folds the cover.
      if (point.sub(tip.at).dot(tip.outward) < -LOGO_TIP_BEHIND) continue
      return tip
    }
    return null
  }

  function closestOnLogo(point) {
    let best = null
    for (let r = 0; r < logo.length; r++) {
      let ring = logo[r]
      for (let i = 0; i < ring.length; i++) {
        let hit = closestOnSegment(point, ring[i], ring[(i+1) % ring.length])
        let distance = hit.point.distanceTo(point)
        if (!best || distance < best.distance) {
          best = { point: hit.point, distance, ring: r, param: i + hit.t }
        }
      }
    }
    return best
  }

  // Does the ray from origin cross segment a-b? Used both for the outline test and for
  // even-odd point-in-logo, neither of which vector.js has a primitive for.
  function rayCrosses(origin, direction, a, b) {
    let ab = b.sub(a)
    let denominator = direction.x * ab.y - direction.y * ab.x
    if (Math.abs(denominator) < 1e-9) return false
    let ao = a.sub(origin)
    let t = (ao.x * ab.y - ao.y * ab.x) / denominator
    let u = (ao.x * direction.y - ao.y * direction.x) / denominator
    return t > 0.01 && u >= 0 && u <= 1
  }

  function insideLogo(point) {
    let direction = new Vector(1, 0.0137, 0) // odd slope so the ray misses logo verticies
    let crossings = 0
    for (let ring of logo) {
      for (let i = 0; i < ring.length; i++) {
        if (rayCrosses(point, direction, ring[i], ring[(i+1) % ring.length])) {
          crossings += 1
        }
      }
    }
    return crossings % 2 == 1
  }

  function skeletonSegments() {
    let segments = []
    for (let edge of edges) {
      if (edge.isDupe) continue
      segments.push([
        edge.verticies[0].ogCoords.scale(PIXEL_DISTANCE),
        edge.verticies[1].ogCoords.scale(PIXEL_DISTANCE),
      ])
    }
    return segments
  }

  // Everything the border draws sits a full CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER out from
  // its edge, and nothing else does: slots land at KERF..WALL_THICKNESS from the channel wall,
  // the inner channel at CHANNEL_WIDTH/2 - INNER_CHANNEL_BUFFER, and a seam's centerline point
  // right on the edge. So distance alone separates outline from everything else.
  function isOutlinePoint(point, segments) {
    for (let [a, b] of segments) {
      if (closestOnSegment(point, a, b).point.distanceTo(point)
          < CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER - 0.05) {
        return false
      }
    }
    return true
  }

  function parseCoverPath(d) {
    let subpaths = []
    for (let chunk of d.split("M")) {
      if (chunk.trim().length == 0) continue
      // Coordinates can come out in exponent form (a mitre that lands on zero reads as
      // 8.96e-14); missing the exponent turns that point into a 9mm jump.
      let numbers = chunk.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []
      let points = []
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        points.push(new Vector(parseFloat(numbers[i]), parseFloat(numbers[i+1]), 0))
      }
      if (points.length > 0) subpaths.push(points)
    }
    return subpaths
  }

  function emitCoverPath(subpaths) {
    let d = ""
    for (let points of subpaths) {
      d += "M" + points.map(point => `${point.x} ${point.y}`).join(" L") + " Z "
    }
    return d
  }

  function ringDelta(ringIndex, from, to) {
    let count = logo[ringIndex].length
    let delta = to - from
    while (delta > count/2) delta -= count
    while (delta < -count/2) delta += count
    return delta
  }

  // Snapped points have to advance along the logo in one direction. One that doubles back folds
  // the outline over itself, and on a corner under 90 degrees that fold is the little overlap
  // that stops OpenSCAD rendering the part.
  function dropBacktracks(entries) {
    let result = entries.slice()
    let start = 0
    while (start < result.length) {
      if (result[start].ring === undefined) {
        start += 1
        continue
      }
      let end = start
      while (end + 1 < result.length && result[end+1].ring === result[start].ring) {
        end += 1
      }
      if (end > start + 1) {
        let total = 0
        for (let i = start; i < end; i++) {
          total += ringDelta(result[start].ring, result[i].param, result[i+1].param)
        }
        let direction = Math.sign(total) || 1
        let kept = [result[start]]
        for (let i = start + 1; i <= end; i++) {
          if (ringDelta(result[start].ring, kept.last().param, result[i].param) * direction < 0) {
            continue
          }
          kept.push(result[i])
        }
        result.splice(start, end - start + 1, ...kept)
        end = start + kept.length - 1
      }
      start = end + 1
    }
    return result
  }

  function conformSubpath(points, segments) {
    let isOutline = points.map(point => isOutlinePoint(point, segments))
    if (!isOutline.includes(true)) return points // slots and inner channels stay put

    // Resample the outline so the snapped result follows the logo instead of chording across it
    let sampled = []
    for (let i = 0; i < points.length; i++) {
      let next = (i+1) % points.length
      sampled.push({ point: points[i], isOutline: isOutline[i], isCorner: true })
      if (!isOutline[i] || !isOutline[next]) continue
      let steps = Math.floor(points[i].distanceTo(points[next]) / LOGO_SPACING)
      let delta = points[next].sub(points[i])
      for (let s = 1; s < steps; s++) {
        sampled.push({ point: points[i].addScaledVector(delta, s/steps), isOutline: true })
      }
    }

    let snapped = sampled.map(entry => {
      if (!entry.isOutline) return entry
      // A corner at a tip has to land exactly on the logo's tip. Letting it pick the nearest
      // point on an edge instead leaves a notch, and below 90 degrees the two sides cross over
      // into an overlap that OpenSCAD then refuses to render. Both corners of a dead end's
      // square cap pin to the same tip, which is what brings that cover to a point.
      let tip = logoTipNear(entry.point)
      if (tip && entry.isCorner) {
        return { point: tip.point, isOutline: true, ring: tip.ring, param: tip.segment }
      }
      if (tip) {
        // Everything around a tip has to ride the two logo edges that meet there. Letting these
        // pick the globally nearest point leaves them beside the old blunt end while the corner
        // runs out to the tip, which draws a hairline needle instead of a wedge.
        let ring = logo[tip.ring]
        let previous = (tip.segment - 1 + ring.length) % ring.length
        let before = closestOnSegment(entry.point, ring[previous], ring[tip.segment])
        let after = closestOnSegment(entry.point, ring[tip.segment],
            ring[(tip.segment + 1) % ring.length])
        let onBefore = before.point.distanceTo(entry.point) < after.point.distanceTo(entry.point)
        return {
          point: onBefore ? before.point : after.point,
          isOutline: true,
          ring: tip.ring,
          param: onBefore ? previous + before.t : tip.segment + after.t,
        }
      }
      let hit = closestOnLogo(entry.point)
      if (hit.distance > LOGO_MAX_TRAVEL) return entry
      // Where the logo already covers this point the nearest logo edge can be a long way off in
      // any direction, and chasing it just tears a gap open. Only let it move a little there;
      // the tips still reach because their logo verticies get inserted below.
      if (hit.distance > LOGO_INSIDE_TRAVEL && insideLogo(entry.point)) return entry
      return { point: hit.point, isOutline: true, ring: hit.ring, param: hit.param }
    })

    snapped = dropBacktracks(snapped)

    // Fill out the tips: a spike contributes a single mitre point, so the logo's own corners
    // between two snapped points have to be put back by hand or the tip gets chorded off.
    let result = []
    for (let i = 0; i < snapped.length; i++) {
      let entry = snapped[i]
      let next = snapped[(i+1) % snapped.length]
      result.push(entry.point)
      if (entry.ring === undefined || next.ring === undefined) continue
      if (entry.ring != next.ring) continue
      let ring = logo[entry.ring]
      let delta = ringDelta(entry.ring, entry.param, next.param)
      if (Math.abs(delta) > LOGO_MAX_INSERT) continue
      let at = index => ring[((index % ring.length) + ring.length) % ring.length]
      if (delta > 0) {
        for (let k = Math.floor(entry.param) + 1; k <= entry.param + delta; k++) {
          result.push(at(k))
        }
      } else {
        for (let k = Math.ceil(entry.param) - 1; k >= entry.param + delta; k--) {
          result.push(at(k))
        }
      }
    }

    // Pinning corners collapses the two corners of a dead end's square cap onto the same logo
    // tip, which is what finally brings those covers to a point. Drop the repeats it leaves.
    // Pinning corners collapses the two corners of a dead end's square cap onto the same logo
    // tip, which is what finally brings those covers to a point. Drop the repeats it leaves.
    let deduped = []
    for (let point of result) {
      if (deduped.length > 0 && deduped.last().distanceTo(point) < 0.01) continue
      deduped.push(point)
    }
    if (deduped.length > 2 && deduped[0].distanceTo(deduped.last()) < 0.01) deduped.pop()
    return deduped
  }

  function conformPrint(print, segments, bounds) {
    let parts = findSubprints("svg", print)
    for (let part of parts) {
      let match = part.svg.match(/ d="([^"]*)"/)
      if (!match) continue
      let subpaths = parseCoverPath(match[1])
        .map(points => conformSubpath(points, segments))
        .filter(points => points && points.length > 2)
      part.conformed = subpaths
      for (let points of subpaths) {
        for (let point of points) {
          bounds.minX = Math.min(bounds.minX, point.x)
          bounds.minY = Math.min(bounds.minY, point.y)
          bounds.maxX = Math.max(bounds.maxX, point.x)
          bounds.maxY = Math.max(bounds.maxY, point.y)
        }
      }
    }
  }

  // All of a cover's svg components share one bounds, and importCorrectionOperations is derived
  // from it, so both have to be rewritten once every component is known.
  function rewritePrint(print, bounds) {
    let width = bounds.maxX - bounds.minX
    let height = bounds.maxY - bounds.minY
    for (let part of findSubprints("svg", print)) {
      if (!part.conformed) continue
      part.svg = part.svg
          .replace(/\swidth="[^"]*"/, ` width="${width}"`)
          .replace(/\sheight="[^"]*"/, ` height="${height}"`)
          .replace(/\sviewBox="[^"]*"/,
              ` viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}"`)
          .replace(/ d="[^"]*"/, ` d="${emitCoverPath(part.conformed)}"`)
      delete part.conformed
    }
    print.bounds = bounds
    for (let node of importCorrections(print)) {
      node.position = [bounds.minX, 2*bounds.minY - bounds.maxY, 0]
    }
  }

  function importCorrections(print, found = []) {
    let operations = print.operations
    if (operations && operations.length == 2 &&
        operations[0].type == "translate" && operations[1].type == "mirror") {
      if (!found.includes(operations[0])) found.push(operations[0])
    }
    for (let component of print.components || []) {
      importCorrections(component, found)
    }
    return found
  }

  let originalGenerateManufacturingInfo =
      generateManufacturingInfo.beforeLogo || generateManufacturingInfo
  generateManufacturingInfo = async function() {
    await originalGenerateManufacturingInfo.apply(this, arguments)

    // Covers are rebuilt from scratch on every call, so these bounds are always pre-conform.
    let bounds = { minX: 1e6, minY: 1e6, maxX: -1e6, maxY: -1e6 }
    for (let type of COVER_TYPES) {
      for (let print of covers[type]) {
        if (!print) continue
        bounds.minX = Math.min(bounds.minX, print.bounds.minX)
        bounds.minY = Math.min(bounds.minY, print.bounds.minY)
        bounds.maxX = Math.max(bounds.maxX, print.bounds.maxX)
        bounds.maxY = Math.max(bounds.maxY, print.bounds.maxY)
      }
    }
    if (bounds.maxY < bounds.minY) return

    if (!logo) {
      logo = parseLogo(await (await fetch(LOGO_URL)).text(), bounds)
      tips = findTips(new Vector(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2,
        0,
      ))
    }

    let segments = skeletonSegments()
    for (let type of COVER_TYPES) {
      for (let print of covers[type]) {
        if (!print) continue
        let printBounds = { minX: 1e6, minY: 1e6, maxX: -1e6, maxY: -1e6 }
        conformPrint(print, segments, printBounds)
        if (printBounds.maxY < printBounds.minY) continue
        printBounds.minX = Math.floor(printBounds.minX)
        printBounds.minY = Math.floor(printBounds.minY)
        printBounds.maxX = Math.ceil(printBounds.maxX)
        printBounds.maxY = Math.ceil(printBounds.maxY)
        rewritePrint(print, printBounds)
      }
    }
  }
  generateManufacturingInfo.beforeLogo = originalGenerateManufacturingInfo
}
