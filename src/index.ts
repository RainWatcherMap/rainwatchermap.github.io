import allRegions from './hierarchy.json'
import ignore from './ignore.json'
import { setup } from './camera.js'

type RegionKey = keyof typeof allRegions
type Region = (typeof allRegions)[RegionKey]

const regions: Partial<Record<RegionKey, Region>> = {}
for(const rk in allRegions) {
    if(ignore.region.includes(rk)) continue
    regions[rk] = allRegions[rk]
}

// half height of camera
// const size = 384

const outer = window.map_container
const inner = window.map_content

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
}

setup(context)

const regionsEl = window.regions

// null if show all
function fillRegions(filter: string | null) {
    const regs: Array<{ key: RegionKey, region: Region }> = []
    for(const regK in regions) {
        if(filter && !regK.includes(filter)) continue
        regs.push({ key: regK as any, region: regions[regK] })
    }
    regionsEl.innerHTML = ''
    for(const reg of regs) {
        const el = document.createElement('div')
        el.append(document.createTextNode(`${reg.region.data.name} (${reg.key})`))
        el.classList.add('region')
        el.onclick = () => {
            for(const other of document.querySelectorAll('.region-selected')) {
                other.classList.remove('region-selected')
            }
            el.classList.add('region-selected')
            showRegion(reg.key, reg.region)
        }
        regionsEl.append(el)
    }
}

function showRegion(regionName: RegionKey, region: Region) {
    inner.innerHTML = ''
    var minX = Infinity
    var maxX = -Infinity
    var minY = Infinity
    var maxY = -Infinity

    const layers: Set<number> = new Set()
    const layerEls: Map<number, HTMLElement> = new Map()

    const markerLayerEls: Map<number, HTMLElement> = new Map()

    for(const k in region.rooms) {
        const room = region.rooms[k as RegionKey]
        if(!room.data.mapPos) continue
        const layer = room.data.layer
        layers.add(layer)

        for(const s of room.screens) {
            const ps = s.split('$')
            let x = room.data.mapPos[0] / 3 - room.data.size[0] * 0.5
            let y = room.data.mapPos[1] / 3 - room.data.size[1] * 0.5
            x += Number(ps[0]) / 20
            y += Number(ps[1]) / 20

            const image = document.createElement('img')
            image.classList.add('bg')
            image.setAttribute('src', '/images/' + regionName + '/' + k + '/' + s)
            image.style.left = x + 'px'
            image.style.top = -y + 'px'

            minX = Math.min(minX, x)
            maxX = Math.max(maxX, x)
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)

            let v = layerEls.get(layer)
            if(!v) {
                v = document.createElement('div')
                v.classList.add('room-layer')
                v.style.position = 'absolute'
                layerEls.set(layer, v)
            }

            v.append(image)
        }
    }

    const layersArr = [...layers]
    layersArr.sort((a, b) => a - b)

    for(const l of layersArr) {
        inner.append(layerEls.get(l))
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

    context.camera.posX = (minX + maxX) * 0.5
    context.camera.posY = (minY + maxY) * 0.5
    context.requestRender()

    {
        window.layers.innerHTML = ''

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

        window.layers.append(
            document.createTextNode('Layers:'),
            form,
        )
    }
}

fillRegions(null)
