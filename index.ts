import hierarchy from './hierarchy.json'
import { setup } from './camera.js'

// half height of camera
// const size = 384

const outer = window.map_container
const inner = window.map_content

setup({
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
})

const regionName = 'WARD'
const region = hierarchy[regionName]

var minX = Infinity
var maxY = -Infinity

for(const k in region) {
    const room = region[k]
    if(room.data.warpPoints?.length > 0) console.log(k, room.data.warpPoints)
    for(const s of room.screens) {
        const ps = s.split('$')
        let x = room.data.mapPos[0] / 3 - room.data.size[0] * 0.5
        let y = room.data.mapPos[1] / 3 - room.data.size[1] * 0.5
        x += Number(ps[0]) / 20
        y += Number(ps[1]) / 20

        const image = document.createElement('img')
        image.classList.add('bg')
        image.setAttribute('src', '/output/' + regionName + '/' + k + '/' + s)
        image.style.left = x + 'px'
        image.style.top = -y + 'px'

        minX = Math.min(minX, x)
        maxY = Math.max(maxY, y)

        inner.append(image)
    }
}
