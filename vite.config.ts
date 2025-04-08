import { defineConfig, type Plugin } from 'vite'
//import virtualHtml, { type PageObject } from 'vite-plugin-virtual-html'
import { join, normalize } from 'node:path'
import fsp from 'node:fs/promises'

const cur = import.meta.dirname

const hierarchyP = fsp.readFile(join(cur, 'src', 'hierarchy.json'))
const ignoreP = fsp.readFile(join(cur, 'src', 'ignore.json'))
const templateP = fsp.readFile(join(cur, 'src', 'index.html'))
const [hierarchyB, ignoreB, templateB] = await Promise.all([hierarchyP, ignoreP, templateP])

const hierarchy = JSON.parse(hierarchyB.toString('utf8'))
const ignore = JSON.parse(ignoreB.toString('utf8'))
const template = templateB.toString('utf8')

const regions: string[] = []
for(const regK in hierarchy) {
    if(!ignore.region.includes(regK)) regions.push(regK)
}

function genRegions(curName: string, addHidden: boolean) {
    let regionsHtml = ''
    regionsHtml += '<script>window.defaultRegion = "' + curName + '"</script>'

    regionsHtml += `<div id="regions"${addHidden ? ' class="regions-hidden"' : ''}>`
    for(const regK of regions) {
        const e = curName === regK
        regionsHtml += `<a data-region="${regK}" class="region${e ? ' region-selected' : ''}" href="/${regK.toLowerCase()}" onClick="event.preventDefault()">${hierarchy[regK].data.name} (${regK})</a>`
    }
    regionsHtml += '</div>'
    if(addHidden) {
        regionsHtml += `<form class="unhide"><i>hidden</i><label><input id='show_regions' type='radio'>Show</label></form>`
    }

    return regionsHtml
}

type PageObject = {
    render: () => string
}

const pages: Record<string, PageObject> = {}
for(const regK of regions) {
    pages[regK.toLowerCase()] = {
        render: () => {
            const regName = hierarchy[regK].data.name
            const html = template
            .replace(
                '$$$TITLE$$$',
                regName + ' Map — Rain World: The Watcher DLC'
            )
            .replace(
                '$$$DESC$$$',
                'Interactive map of ' + regName + ' in Rain World: The Watcher DLC. Warps, echoes, and karma flowers.'
            )
            .replace(
                '$$$KEYWORDS$$$',
                ', rain world watcher ' + regName
            )
            .replace(
                '$$$REGIONS$$$',
                genRegions(regK, true)
            )

            return html
        }
    }
}

pages.index = {
    render: () => {
        const html = template
        .replace(
            '$$$TITLE$$$',
            'Rain World: The Watcher DLC'
        )
        .replace(
            '$$$DESC$$$',
            'Interactive map of Rain World: The Watcher DLC. Regions, warps, echoes, and karma flowers.'
        )
        .replace(
            '$$$KEYWORDS$$$',
            ''
        )
        .replace(
            '$$$REGIONS$$$',
            genRegions('HI', false)
        )

        return html
    },
}

export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
    return {
        root: join(cur, 'src'),
        publicDir: join(cur, 'public'),
        build: {
            outDir: join(cur, 'dist'),
            emptyOutDir: true,
        },
        worker: { format: 'es' },
        plugins: [
            virtualHtml({ pages })
        ],
    }
})

type InputOption = string | string[] | Record<string, string>

function virtualHtml({ pages }: { pages: Record<string, PageObject> }): Plugin {
    function mki(input?: InputOption): InputOption {
        if(typeof input === 'string') {
            return [input, ...Object.keys(pages).map(it => '/' + it + '.html')]
        }
        else if(Array.isArray(input)) {
            return [...input, ...Object.keys(pages).map(it => '/' + it + '.html')]
        }
        else {
            const res = { ...input }
            for(const k in pages) res[k] = k + '.html'
            return res
        }
    }

    const name = 'my-vite-plugin-virtual-html'
    let curRoot: string = undefined as any

    return {
        name,
        config: config => {
            curRoot = config.root as any
            return {
                ...config,
                build: {
                    ...config.build,
                    rollupOptions: {
                        ...config.build?.rollupOptions,
                        input: mki(config.build?.rollupOptions?.input),
                    }
                }
            }
        },
        configureServer: server => {
            server.middlewares.use(async(req, res, next) => {
                if(req.url == null || req.originalUrl == null) return next()
                const id = req.originalUrl.substring(1)
                const page = id === '' ? pages.index : pages[id]
                if(!page) return next()

                res.end(Buffer.from(
                    await server.transformIndexHtml(
                        req.url,
                        page.render()
                    ),
                    'utf8',
                ))
            })
        },
        resolveId: (id) => {
            if(id.endsWith('.html')) {
                if(pages[id.substring(0, id.length - '.html'.length)]) {
                    return curRoot + '/' + id
                }
            }
        },
        load: (id) => {
            const prefix = curRoot + '/'
            if(id.startsWith(prefix) && id.endsWith('.html')) {
                const p = pages[id.substring(prefix.length, id.length - '.html'.length)]
                if(p) {
                    return {
                        code: p.render(),
                        name: id,
                    }
                }
            }
        },
    }
}
