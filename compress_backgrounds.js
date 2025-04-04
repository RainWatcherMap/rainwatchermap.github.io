// @ts-check
import sharp from 'sharp'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { join } from 'node:path'
import B from './src/hierarchy.json' with { type: 'json' }
import ignore from './src/ignore.json' with { type: 'json' }

const srcPath = join(import.meta.dirname, 'raw', 'regions')
const dstPath = join(import.meta.dirname, 'public', 'images')

fs.mkdirSync(dstPath, { recursive: true })

const filenames = []
for(const regionK in B) {
    if(ignore.region.includes(regionK)) continue
    const region = B[regionK]
    for(const roomK in region.rooms) {
        const room = region.rooms[roomK]
        for(const imageName of room.screens) {
            filenames.push([join(regionK, roomK), imageName])
        }
    }
}

var done = 0
function updateDone() {
    done++
    if(done % 10 === 0) console.log('done', done, 'of ' + filenames.length)
}

for(let i = 0; i < filenames.length; i++) {
    const dn = filenames[i][0]
    const fn = filenames[i][1]
    const img = sharp(join(srcPath, dn, fn))
    ;(async() => {
        const ddn = join(dstPath, dn)
        await fsp.mkdir(ddn, { recursive: true })
        await img.png({ compressionLevel: 9, palette: true }).toFile(join(ddn, fn))
        updateDone()
    })()
}
