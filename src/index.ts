import allRegions from './hierarchy.json'
import ignore from './ignore.json'
import { setup } from './camera.js'

type WarpPoint = {
    region: string | null
    room: string | null
    pos: [number, number] | null // within room
    oneWay: boolean
}
type EchoData = {
    panelPos: [number, number] | null
    destPos: [number, number] | null
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
        warpPoints: WarpPoint[]
        echoSpots: EchoData[]
    } | { mapPos?: never }
}
type RegionKey = string
type Region = {
    rooms: Record<string, Room>
    data: {
      name: string
    }
}

const regionNames: Map<RegionKey, string> = new Map()

const regions: Record<RegionKey, Region> = {}
for(const rk in allRegions) {
    if(ignore.region.includes(rk)) continue
    regions[rk] = allRegions[rk]
    regionNames.set(rk, regions[rk].data.name + ' (' + rk + ')')
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
        scale: 500,
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

const regionsEl = (window as any).regions

function setSelected(el?: HTMLElement) {
    for(const other of document.querySelectorAll('.region-selected')) {
        other.classList.remove('region-selected')
    }
    if(el) el.classList.add('region-selected')
}

let regionEls: Map<string, HTMLElement> = new Map()

// null if show all
function fillRegions(filter: string | null) {
    regionEls = new Map()

    const regs: Array<{ key: RegionKey, region: Region }> = []
    for(const regK in regions) {
        if(filter && !regK.includes(filter)) continue
        regs.push({ key: regK as any, region: regions[regK] })
    }
    regionsEl.innerHTML = ''
    for(const reg of regs) {
        const el = document.createElement('div')
        el.append(document.createTextNode(regionNames.get(reg.key)!))
        el.classList.add('region')
        el.onclick = () => {
            setSelected(el)
            showRegion(reg.key, reg.region)
        }
        regionsEl.append(el)
        regionEls.set(reg.key, el)
    }
}

function lget(list: Map<number, HTMLElement>, layer: number) {
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

function showRegion(regionName: RegionKey, region: Region, pos?: [number, number]) {
    inner.innerHTML = ''
    var minX = Infinity
    var maxX = -Infinity
    var minY = Infinity
    var maxY = -Infinity

    const layers: Set<number> = new Set()
    const layerEls: Map<number, HTMLElement> = new Map()

    const markerLayerEls: Map<number, HTMLElement> = new Map()

    const markers: Array<Marker & { element: HTMLElement }> = []

    for(const k in region.rooms) {
        const room = region.rooms[k]
        if(!room.data.mapPos) continue
        const layer = room.data.layer
        layers.add(layer)

        let totalX = 0
        let totalY = 0
        let count = 0

        for(const s of room.screens) {
            const ps = s.split('$')
            let x = room.data.mapPos[0] / 3 - room.data.size[0] * 0.5
            let y = room.data.mapPos[1] / 3 - room.data.size[1] * 0.5
            x += Number(ps[0]) / 20
            y += Number(ps[1]) / 20

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

        for(let i = 0; i < room.data.warpPoints.length; i++) {
            const it = room.data.warpPoints[i]

            const v = lget(markerLayerEls, layer)
            const m = document.createElement('div')
            m.classList.add('marker-warp')
            if(it.oneWay) m.classList.add('warp-oneway')
            const mx = totalX / count
            const my = totalY / count
            m.style.left = mx + 'px'
            m.style.top = -my + 'px'
            v.append(m)
            markers.push({ type: 'warp', position: [mx, my], data: it, element: m })
        }

        for(let i = 0; i < room.data.echoSpots.length; i++) {
            const it = room.data.echoSpots[i]

            const v = lget(markerLayerEls, layer)
            const m = document.createElement('div')
            m.classList.add('marker-echo')
            const mx = totalX / count
            const my = totalY / count
            m.style.left = mx + 'px'
            m.style.top = -my + 'px'
            v.append(m)
            markers.push({ type: 'echo', position: [mx, my], data: it, element: m })
        }
    }

    const layersArr = [...layers]
    layersArr.sort((a, b) => a - b)

    for(const l of layersArr) {
        const e = layerEls.get(l)
        if(e) inner.append(e)
    }
    for(const l of layersArr) {
        const e = markerLayerEls.get(l)
        if(e) inner.append(e)
    }

    let curLayer = layersArr[0]
    function setLayer(l: number) {
        curLayer = l
        for(const ol of layersArr) {
            const el = layerEls.get(ol)
            if(!el) continue
            el.style.opacity = l == ol ? '1' : '0.2'
        }
    }
    setLayer(curLayer)

    if(!pos) pos = [(minX + maxX) * 0.5, (minY + maxY) * 0.5]
    context.camera.posX = pos[0]
    context.camera.posY = pos[1]
    context.requestRender()

    {
        const layerEl = (window as any).layers
        layerEl.innerHTML = ''

        const form = document.createElement('form')
        for(const l of layersArr) {
            const cont = document.createElement('label')
            const input = document.createElement('input')
            input.setAttribute('type', 'radio')
            if(l == curLayer) input.setAttribute('checked', '')
            input.setAttribute('name', 'layer')
            input.setAttribute('value', '' + l)
            input.onchange = () => setLayer(l)
            cont.append(input, document.createTextNode('' + (l === undefined ? '<none>' : l)))
            form.append(cont)
        }

        layerEl.append(
            document.createTextNode('Layers:'),
            form,
        )
    }

    context.onClick = (cx, cy) => {
        console.log(cx, cy)
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

            function gotoButton(regionName: RegionKey | null, roomName: string | null) {
                if(!regionName || !roomName) return

                const el = document.createElement('button')
                el.setAttribute('type', 'button')
                el.append(document.createTextNode('go to'))
                el.onclick = () => {
                    for(const regK in allRegions) {
                        if(regionName.toLowerCase() === regK.toLowerCase()) {
                            const region = allRegions[regK]
                            for(const roomK in region.rooms) {
                                if(roomName.toLowerCase() === roomK.toLowerCase()) {
                                    const room = region.rooms[roomK]
                                    if(room && room.data.mapPos) {
                                        let x = room.data.mapPos[0] / 3 - room.data.size[0] * 0.5
                                        let y = room.data.mapPos[1] / 3 - room.data.size[1] * 0.5
                                        pos = [x, y]
                                    }
                                }
                            }
                        }
                    }
                    console.log(pos)
                    showRegion(regionName, allRegions[regionName], pos ?? undefined)
                    setSelected(regionEls.get(regionName))
                }
                return el
            }

            if(c[1].type === 'warp') {
                const it = c[1].data
                elementEl.append(wrap('Warp point'))
                elementEl.append(wrap('Destination region: ' + (it.region ? regionNames.get(it.region) : it.region)))
                elementEl.append(wrap('Destination room: ' + it.room))
                //elementEl.append(wrap('Destination position: ' + it.pos))
                elementEl.append(wrap('One way?: ' + it.oneWay))
                const b = gotoButton(it.region, it.room)
                if(b) elementEl.append(b)
            }
            else {
                const it = c[1].data
                elementEl.append(wrap('Echo'))
                elementEl.append(wrap('Destination region: ' + (it.destRegion ? regionNames.get(it.destRegion) : it.destRegion)))
                elementEl.append(wrap('Destination room: ' + it.destRoom))
                //elementEl.append(wrap('Destination position: ' + it.destPos))
                const b = gotoButton(it.destRegion, it.destRoom)
                if(b) elementEl.append(b)
            }
        }
    }
}

fillRegions(null)
