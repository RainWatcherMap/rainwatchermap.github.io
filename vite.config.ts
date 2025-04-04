import { defineConfig } from 'vite'

import { join, normalize } from 'node:path'

const cur = import.meta.dirname

export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
    return {
        root: join(cur, 'src'),
        publicDir: join(cur, 'public'),
        build: {
            outDir: join(cur, 'dist'),
            emptyOutDir: true,
        },
        worker: { format: 'es' },
    }
})
