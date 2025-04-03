import hierarchy from './hierarchy.json'

// half height
const size = 384

const content = window.content

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
        image.style.left = x * 10 + 'px'
        image.style.top = -y * 10 + 'px'

        minX = Math.min(minX, x)
        maxY = Math.max(maxY, y)

        content.append(image)
    }
}
content.style.transform = `translate(${(-minX - 10) * 10}px, ${(maxY + 10) * 10}px)`
