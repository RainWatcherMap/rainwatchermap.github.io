import allRegions from './hierarchy.json'
import ignore from './ignore.json'
import { setup } from './camera.js'

type Pos = [number, number]
type WarpPoint = {
    pos: Pos
    destRegion: string | null
    destRoom: string | null
    destPos: Pos | null // within room
    oneWay: boolean
    ripple: boolean
}
type EchoData = {
    pos: Pos
    panelPos: Pos | null
    destPos: Pos | null
    destRegion: string | null
    destRoom: string | null
    spawnId: number
}

type Room = {
    screens: string[]
    data: {
        mapPos: [number, number]
        size: [number, number]
        layer: number
        shelter: boolean
        warpPoints: WarpPoint[]
        echoSpots: EchoData[]
        karmaFlowers: { pos: Pos }[]
    } | { mapPos?: never }
}
type RegionKey = string
type Region = {
    rooms: Record<string, Room>
    data: {
        name: string
        shortcuts: {
            roomA: string
            roomB: string
            posA: Pos
            posB: Pos
            dirA: string
            dirB: string
        }[]
    }
}

const regionNames: Map<RegionKey, string> = new Map()

const regions: Record<RegionKey, Region> = {}
for(const rk in allRegions) {
    if(ignore.region.includes(rk)) continue
    regions[rk] = allRegions[rk]
    regionNames.set(rk, regions[rk].data.name + ' (' + rk + ')')

    /*const r = regions[rk]
    for(const rok in r.rooms) {
        const ro = r.rooms[rok]
        if(!ro.data.mapPos) continue
        for(const sc of ro.data.shortcuts) {
            iiii++
            if(sc.startRoom != sc.roomB) console.log(rok, sc.roomB)
        }
    }*/
}

type TraceData = {
    type: 'warp'
    data: WarpPoint
} | {
    type: 'echo'
    data: EchoData
}
type WarpTrace = {
    fromRegion: RegionKey
    fromRoom: string
    from: TraceData
    pos: Pos | null
}

// backlinks by toRegion and toRoom
const backlinks: Record<RegionKey, Record<string, WarpTrace[]>> = {}
function bfill(toRegion: string | null, toRoom: string | null, trace: WarpTrace) {
    if(!toRegion || !toRoom) return
    toRegion = toRegion.toLowerCase()
    toRoom = toRoom.toLowerCase()

    let a = backlinks[toRegion]
    if(!a) backlinks[toRegion] = a = {}
    let b = a[toRoom]
    if(!b) a[toRoom] = b = []
    b.push(trace)
}

for(const regK in regions) {
    const region = regions[regK]
    for(const roomK in region.rooms) {
        const room = region.rooms[roomK]
        if(!room.data.mapPos) continue
        for(const wp of room.data.warpPoints) {
            bfill(wp.destRegion, wp.destRoom, {
                fromRegion: regK,
                fromRoom: roomK,
                from: { type: 'warp', data: wp },
                pos: wp.destPos,
            })
        }
        for(const wp of room.data.echoSpots) {
            bfill(wp.destRegion, wp.destRoom, {
                fromRegion: regK,
                fromRoom: roomK,
                from: { type: 'echo', data: wp },
                pos: wp.destPos,
            })
        }
    }
}

// half height of camera
// const size = 384

const outer = (window as any).map_container
const inner = (window as any).map_content

const context = {
    canvas: outer,
    camera: {
        posX: 0,
        posY: 0,
        scale: 300,
    },
    canvasSize: [1, 1],
    sizes: { fontSize: 16, heightCssPx: 1000 },
    requestRender() {
        const c = this.camera
        const r = inner
        const rect = outer.getBoundingClientRect()
        const height = rect.height
        const scale = 0.5 * height / c.scale
        const x = -c.posX * scale
        const y = c.posY * scale
        r.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y})`
    },
    onClick: (a: number, b: number) => {}
}

setup(context)

function setSelected(region: string) {
    const el = regionEls.get(region)
    if(!el) return
    showSelected(el.parentNode as any, region)
}
function showSelected(el: HTMLElement | undefined, region: string) {
    history.pushState({}, '', '/' + region.toLowerCase())
    for(const other of document.querySelectorAll('.region-selected')) {
        other.classList.remove('region-selected')
    }
    if(el) el.classList.add('region-selected')
}

window.addEventListener('popstate', () => {
    const url = new URL(window.location.toString())
    const regionName = url.pathname.substring(1).toUpperCase()
    const region = regions[regionName]
    if(region) {
        showRegion(regionName, regions[regionName], undefined)
    }
})

let regionEls: Map<string, HTMLElement> = new Map()

const regionElsArr = [...document.querySelectorAll('#regions > .region')]
for(const el0 of regionElsArr) {
    const el = el0 as HTMLElement
    const regK = el.getAttribute('data-region') as string

    const reg = regions[regK]
    if(!reg) {
        el.style.display = 'none'
        continue
    }

    el.onclick = (ev) => {
        ev.preventDefault()
        showSelected(el, regK)
        showRegion(regK, reg)
    }
    regionEls.set(regK, el)
}

// null if show all
function fillRegions(filter: string | null) {
    const regs: Array<{ key: RegionKey, region: Region }> = []
    for(const regK in regions) {
        if(filter && !regK.includes(filter)) continue
        regs.push({ key: regK as any, region: regions[regK] })
    }

    for(const el0 of regionElsArr) {
        const el = el0 as HTMLElement
        const regK = el.getAttribute('data-region') as string
        const reg = regions[regK]
        if((filter && !regK.includes(filter)) || !reg) {
            el.style.display = 'none'
        }
        else {
            el.style.display = ''
        }
    }
}

function lget<T>(list: Map<T, HTMLElement>, layer: T) {
    let v = list.get(layer)
    if(!v) {
        v = document.createElement('div')
        v.style.position = 'absolute'
        list.set(layer, v)
    }
    return v
}

type Marker = {
    type: 'warp'
    position: [number, number]
    data: WarpPoint
}
| {
    type: 'echo'
    position: [number, number]
    data: EchoData
}
| {
    type: 'backlink'
    position: [number, number]
    data: WarpTrace
}
| {
    type: 'karma-flower',
    position: Pos
    data: { pos: Pos }
}

const halfWidth = 69 * 0.5
const halfHeight = 39 * 0.5

let showConnections = true

function showRegion(regionName: RegionKey, region: Region, pos?: [number, number], layerI?: number) {
    inner.innerHTML = ''
    var minX = Infinity
    var maxX = -Infinity
    var minY = Infinity
    var maxY = -Infinity

    const layers: Set<number | 'shelter'> = new Set()
    const layerEls: Map<number | 'shelter', HTMLElement> = new Map()

    const markerLayerEls: Map<number | 'shelter', HTMLElement> = new Map()
    const markers: Array<Marker & { element: HTMLElement }> = []
    const connectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

    for(const k in region.rooms) {
        const room = region.rooms[k]
        if(!room.data.mapPos) continue
        const layer = room.data.shelter ? 'shelter' : room.data.layer
        layers.add(layer)

        let totalX = 0
        let totalY = 0
        let count = 0

        const bx = room.data.mapPos[0] / 3 - room.data.size[0] * 0.5
        const by = room.data.mapPos[1] / 3 - room.data.size[1] * 0.5

        for(const s of room.screens) {
            const ps = s.split('$')
            const x = bx + Number(ps[0]) / 20
            const y = by + Number(ps[1]) / 20

            totalX += x
            totalY += y
            count++

            const image = document.createElement('img')
            image.classList.add('bg')
            image.setAttribute('src', '/images/' + regionName + '/' + k + '/' + s)
            image.style.left = x + 'px'
            image.style.top = -y + 'px'

            minX = Math.min(minX, x)
            maxX = Math.max(maxX, x)
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)

            lget(layerEls, layer).append(image)
        }

        const mx = totalX / count + halfWidth
        const my = totalY / count + halfHeight

        const remBacklinks = backlinks[regionName.toLowerCase()]?.[k.toLowerCase()]?.slice()
        function clearBacklink(fromRegion: string | null, fromRoom: string | null) {
            if(!remBacklinks || !fromRegion || !fromRoom) return
            fromRegion = fromRegion.toLowerCase()
            fromRoom = fromRoom.toLowerCase()
            for(let i = remBacklinks.length - 1; i > -1; i--) {
                const b = remBacklinks[i]
                if(b.fromRegion.toLowerCase() === fromRegion && b.fromRoom.toLowerCase() === fromRoom) {
                    remBacklinks.splice(i, 1)
                }
            }
        }

        for(let i = 0; i < room.data.warpPoints.length; i++) {
            const it = room.data.warpPoints[i]
            const x = bx + it.pos[0] / 20
            const y = by + it.pos[1] / 20

            const v = lget(markerLayerEls, layer)
            const m = document.createElement('div')
            m.classList.add('marker-warp')
            if(it.oneWay) m.classList.add('warp-oneway')
            m.style.left = x + 'px'
            m.style.top = -y + 'px'
            v.append(m)

            markers.push({ type: 'warp', position: [x, y], data: it, element: m })
            clearBacklink(it.destRegion, it.destRoom)
        }

        for(let i = 0; i < room.data.echoSpots.length; i++) {
            const it = room.data.echoSpots[i]
            const x = bx + it.pos[0] / 20
            const y = by + it.pos[1] / 20

            const v = lget(markerLayerEls, layer)
            const m = document.createElement('div')
            m.classList.add('marker-echo')
            m.style.left = x + 'px'
            m.style.top = -y + 'px'
            v.append(m)

            markers.push({ type: 'echo', position: [x, y], data: it, element: m })
            clearBacklink(it.destRegion, it.destRoom)
        }

        for(let i = 0; remBacklinks && i < remBacklinks.length; i++) {
            const it = remBacklinks[i]

            const x = it.pos ? bx + it.pos[0] / 20 : mx
            const y = it.pos ? by + it.pos[1] / 20 : my

            const v = lget(markerLayerEls, layer)
            const m = document.createElement('div')
            m.classList.add('marker-backlink')
            m.style.left = x + 'px'
            m.style.top = -y + 'px'
            v.append(m)
            markers.push({ type: 'backlink', position: [x, y], data: remBacklinks[i], element: m })
        }

        for(let i = 0; i < room.data.karmaFlowers.length; i++) {
            const it = room.data.karmaFlowers[i]

            const x = it.pos ? bx + it.pos[0] / 20 : mx
            const y = it.pos ? by + it.pos[1] / 20 : my

            const v = lget(markerLayerEls, layer)
            const m = document.createElement('div')
            m.classList.add('marker-karma')
            m.style.left = x + 'px'
            m.style.top = -y + 'px'
            v.append(m)
            markers.push({ type: 'karma-flower', position: [x, y], data: it, element: m })
        }
    }

    {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity

        for(const it of region.data.shortcuts) {
            const room = region.rooms[it.roomA]
            if(!room || !room.data.mapPos) {
                console.warn(it.roomA)
                continue
            }
            const eroom = region.rooms[it.roomB]
            if(!eroom || !eroom.data.mapPos) {
                console.warn(it.roomB)
                continue
            }

            const bx = room.data.mapPos[0] / 3 - room.data.size[0] * 0.5
            const by = room.data.mapPos[1] / 3 - room.data.size[1] * 0.5

            const ebx = eroom.data.mapPos[0] / 3 - eroom.data.size[0] * 0.5
            const eby = eroom.data.mapPos[1] / 3 - eroom.data.size[1] * 0.5

            const sx = bx + it.posA[0]
            const sy = -(by + it.posA[1])

            const ex = ebx + it.posB[0]
            const ey = -(eby + it.posB[1])

            minX = Math.min(minX, sx, ex)
            maxX = Math.max(maxX, sx, ex)

            minY = Math.min(minY, sy, ey)
            maxY = Math.max(maxY, sy, ey)

            {
                /*const m = document.createElement('div')
                 m.classList.add('marker-karma')
                 m.style.left = x + 'px'
                 m.style.top = -y + 'px'*/

                // Note: upside down from game
                const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]].map(it => [it[0] * 10, it[1] * 10])

                /*const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
                line.setAttribute('x1', (sx - minX).toString())
                line.setAttribute('x2', (ex - minX).toString())
                line.setAttribute('y1', '' + (sy - minY))
                line.setAttribute('y2', '' + (ey - minY))
                m.append(line)*/

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
                path.setAttribute(
                    'd',
                    'M ' + sx
                        + ' ' + sy
                        + ' C ' + (sx - directions[it.dirA][0])
                        + ' ' + (sy - directions[it.dirA][1])
                        + ' ' + (ex - directions[it.dirB][0])
                        + ' ' + (ey - directions[it.dirB][1])
                        + ' ' + ex
                        + ' ' + ey
                )
                connectionLayer.append(path)
            }

            if(false) {
                const x = bx + it.posA[0]
                const y = by + it.posA[1]

                const m = document.createElement('div')
                m.classList.add('marker-karma')
                m.style.left = x + 'px'
                m.style.top = -y + 'px'
                v.append(m)
                markers.push({ type: 'karma-flower', position: [x, y], data: it, element: m })
            }

            if(false) {
                const x = bx + it.posB[0]
                const y = by + it.posB[1]

                const m = document.createElement('div')
                m.classList.add('marker-karma')
                m.style.left = x + 'px'
                m.style.top = -y + 'px'
                v.append(m)
                markers.push({ type: 'karma-flower', position: [x, y], data: it, element: m })
            }
        }

        minX -= 20
        minY -= 20
        maxX += 20
        maxY += 20
        const width = maxX - minX
        const height = maxY - minY

        connectionLayer.classList.add('connection')
        connectionLayer.style.left = minX + 'px'
        connectionLayer.style.top = minY + 'px'
        connectionLayer.style.width = width + 'px'
        connectionLayer.style.height = height + 'py'
        connectionLayer.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`)
    }

    const layersArr = [...layers]
    layersArr.sort((a, b) => {
        if(a === 'shelter' && b === 'shelter') return 0
        if(a === 'shelter') return 1
        if(b === 'shelter') return -1
        return a - b
    })

    for(const l of layersArr) {
        const e = layerEls.get(l)
        if(e) inner.append(e)
    }
    for(const l of layersArr) {
        const e = markerLayerEls.get(l)
        if(e) inner.append(e)
    }

    inner.append(connectionLayer)

    let curLayer = layersArr[layerI ?? 0]
    function setLayer(l: number | 'shelter') {
        curLayer = l
        for(const ol of layersArr) {
            const el = layerEls.get(ol)
            if(!el) continue
            el.style.opacity = l == ol ? '1' : '0.2'
        }
        for(const ol of layersArr) {
            const el = markerLayerEls.get(ol)
            if(!el) continue
            el.style.opacity = l == ol ? '1' : '0.5'
        }
    }
    setLayer(curLayer)

    function updConnections() {
        if(showConnections) connectionLayer.style.opacity = '1'
        else connectionLayer.style.opacity = '0'
    }
    updConnections()

    if(!pos) pos = [(minX + maxX) * 0.5, (minY + maxY) * 0.5]
    context.camera.posX = pos[0] + halfWidth
    context.camera.posY = pos[1] + halfHeight
    context.requestRender()

    {
        const layerEl = (window as any).layers
        layerEl.innerHTML = ''

        const form = document.createElement('form')

        const layers = document.createElement('div')
        layers.classList.add('layer-inputs')
        for(const l of layersArr) {
            const cont = document.createElement('label')
            cont.classList.add('layer')
            const input = document.createElement('input')
            input.setAttribute('type', 'radio')
            if(l == curLayer) input.setAttribute('checked', '')
            input.setAttribute('name', 'layer')
            input.setAttribute('value', '' + l)
            input.onchange = () => setLayer(l)
            cont.append(input, document.createTextNode('' + (l === undefined ? '<none>' : l)))
            layers.append(cont)
        }
        form.append(layers)

        {
            const cont = document.createElement('label')
            const input = document.createElement('input')
            input.setAttribute('type', 'checkbox')
            if(showConnections) input.setAttribute('checked', '')
            input.setAttribute('name', 'connections')
            input.onchange = () => {
                showConnections = input.checked
                updConnections()
            }
            cont.append(input, 'Room connections')
            form.append(cont)

        }


        layerEl.append(form)
    }

    context.onClick = (cx, cy) => {
        const closest: [distance: number, object: (Marker & { element: HTMLElement }) | null][] = Array(20)
        for(let i = 0; i < closest.length; i++) {
            closest[i] = [1/0, null]
        }

        for(let i = 0; i < markers.length; i++) {
            const obj = markers[i]
            const pos = obj.position
            const dx = pos[0] - cx
            const dy = pos[1] - cy
            const sqDist = dx*dx + dy*dy

            var insertI = 0
            while(insertI < closest.length && closest[insertI][0] < sqDist) insertI++

            if(insertI < closest.length) {
                closest.pop()
                closest.splice(insertI, 0, [sqDist, obj])
            }
        }

        const c = closest[0]
        if(c[1]) {
            const elementEl = (window as any).element
            elementEl.innerHTML = ''

            for(const o of document.querySelectorAll('.marker-selected')) o.classList.remove('marker-selected')
            c[1].element.classList.add('marker-selected')

            function wrap(text: string) {
                var a = document.createElement('div')
                a.append(document.createTextNode(text))
                return a
            }

            function gotoButton(regionName: RegionKey | null, roomName: string | null, destPos: Pos | null) {
                if(!regionName || !roomName) return

                const el = document.createElement('button')
                el.setAttribute('type', 'button')
                el.append(document.createTextNode('go to'))
                el.onclick = () => {
                    for(const regK in allRegions) {
                        if(regionName.toLowerCase() !== regK.toLowerCase()) continue
                        const region = allRegions[regK]
                        for(const roomK in region.rooms) {
                            if(roomName.toLowerCase() !== roomK.toLowerCase()) continue
                            const room = region.rooms[roomK]
                            if(!room || !room.data.mapPos) continue

                            let x = room.data.mapPos[0] / 3 - room.data.size[0] * 0.5
                            let y = room.data.mapPos[1] / 3 - room.data.size[1] * 0.5

                            x += destPos ? destPos[0] / 20 : halfWidth
                            y += destPos ? destPos[1] / 20 : halfHeight

                            pos = [x, y]
                        }
                    }
                    showRegion(regionName, allRegions[regionName], pos ?? undefined)
                    setSelected(regionName.toUpperCase())
                }
                return el
            }

            if(c[1].type === 'warp') {
                const it = c[1].data
                elementEl.append(wrap('Warp point'))
                elementEl.append(wrap('Destination region: ' + (it.destRegion ? regionNames.get(it.destRegion) : it.destRegion)))
                elementEl.append(wrap('Destination room: ' + it.destRoom))
                //elementEl.append(wrap('Destination position: ' + it.pos))
                elementEl.append(wrap('One way?: ' + it.oneWay))
                elementEl.append(wrap('Ripple (likely goes to Daemon): ' + it.ripple))
                const b = gotoButton(it.destRegion, it.destRoom, it.destPos)
                if(b) elementEl.append(b)
            }
            else if(c[1].type === 'echo') {
                const it = c[1].data
                elementEl.append(wrap('Echo'))
                elementEl.append(wrap('Destination region: ' + (it.destRegion ? regionNames.get(it.destRegion) : it.destRegion)))
                elementEl.append(wrap('Destination room: ' + it.destRoom))
                //elementEl.append(wrap('Destination position: ' + it.destPos))
                const b = gotoButton(it.destRegion, it.destRoom, it.destPos)
                if(b) elementEl.append(b)
            }
            else if(c[1].type === 'backlink') {
                const it = c[1].data
                elementEl.append(wrap('Other side of a warp'))
                elementEl.append(wrap('From region: ' + (it.fromRegion ? regionNames.get(it.fromRegion) : it.fromRegion)))
                elementEl.append(wrap('From room: ' + it.fromRoom))
                //elementEl.append(wrap('Destination position: ' + it.destPos))
                const b = gotoButton(it.fromRegion, it.fromRoom, it.from.data.pos)
                if(b) elementEl.append(b)
            }
            else {
                elementEl.append(wrap('Karma flower'))
            }
        }
    }
}


{
    const defaultReg = (window as any).defaultRegion as string

    let pos: Pos | undefined
    let layer: number | undefined
    if(new URL(window.location.toString()).pathname === '/') {
        pos = [-0, 150]
        layer = 1
    }

    fillRegions(null)
    showRegion(defaultReg, regions[defaultReg], pos, layer)

    const showRegionsEl = (window as any).show_regions as HTMLInputElement
    if(showRegionsEl) {
        function showRegions() {
            (window as any).regions.classList.remove('regions-hidden')
            const unhide = (document.querySelector('.unhide') as HTMLElement)
            if(unhide) unhide.style.display = 'none'
        }
        if(showRegionsEl.checked) showRegions()
        showRegionsEl.onchange = () => {
            if(showRegionsEl.checked) showRegions()
        }
    }
}
