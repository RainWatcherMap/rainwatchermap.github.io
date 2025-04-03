import fs from 'node:fs'
import path from 'node:path'

function generateHierarchy(basePath) {
    const hierarchy = {}

    const regions = fs.readdirSync(basePath)
    regions.forEach(region => {
        const regionPath = path.join(basePath, region)
        if (fs.statSync(regionPath).isDirectory()) {
            hierarchy[region] = {}

            const rooms = fs.readdirSync(regionPath)
            rooms.forEach(room => {
                const roomPath = path.join(regionPath, room)
                if (fs.statSync(roomPath).isDirectory()) {
                    hierarchy[region][room] = fs.readdirSync(roomPath)
                        .filter(file => fs.statSync(path.join(roomPath, file)).isFile())
                }
            })
        }
    })

    return hierarchy
}

const basePath = './output'
const hierarchy = generateHierarchy(basePath)
console.log(hierarchy)
fs.writeFileSync("hierarchy.json", JSON.stringify(hierarchy, null, 2))
