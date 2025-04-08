import { join } from 'node:path'
import fsp from 'node:fs/promises'

const cur = join(import.meta.dirname, '..')

const hierarchyP = fsp.readFile(join(cur, 'src', 'hierarchy.json'))
const ignoreP = fsp.readFile(join(cur, 'src', 'ignore.json'))
const [hierarchyB, ignoreB] = await Promise.all([hierarchyP, ignoreP])

const hierarchy = JSON.parse(hierarchyB.toString('utf8'))
const ignore = JSON.parse(ignoreB.toString('utf8'))

const regions = []
for(const regK in hierarchy) {
    if(!ignore.region.includes(regK)) regions.push(regK)
}

const sitemapA = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
const sitemapB = `</urlset>`

let res = sitemapA
res += '<url>https://rainwatchermap.github.io/</url>\n'
for(const r of regions) {
    res += '<url>https://rainwatchermap.github.io/' + r.toLowerCase() + '</url>\n'
}
res += sitemapB

await fsp.writeFile(join(cur, 'public', 'sitemap.xml'), res)
