
import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';

function generateHierarchy(basePath) {
    const hierarchy = {};

    const regions = fs.readdirSync(basePath);
    regions.forEach(region => {
        const regionPath = path.join(basePath, region);
        if (fs.statSync(regionPath).isDirectory()) {
            const regionObj = {
                rooms: {},
                data: JSON5.parse(fs.readFileSync(path.join(regionPath, 'data.json'), 'utf8')),
            }
            hierarchy[region] = regionObj

            const rooms = fs.readdirSync(regionPath);
            rooms.forEach(room => {
                const roomPath = path.join(regionPath, room);
                if (fs.statSync(roomPath).isDirectory()) {
                    let data = {};
                    const dataFilePath = path.join(roomPath, 'data.json');
                    if (fs.existsSync(dataFilePath)) {
                        try {
                            const dataContent = fs.readFileSync(dataFilePath, 'utf8');
                            data = JSON5.parse(dataContent);
                        } catch (error) {
                            console.error(`Error parsing JSON5 in ${dataFilePath}:`, error);
                        }
                    }

                    const screens = fs.readdirSync(roomPath)
                        .filter(file => file !== 'data.json' && fs.statSync(path.join(roomPath, file)).isFile());

                    regionObj.rooms[room] = { screens, data };
                }
            });
        }
    });

    return hierarchy;
}

const basePath = './output'
const hierarchy = generateHierarchy(basePath)
fs.writeFileSync("hierarchy.json", JSON.stringify(hierarchy, null, 2))
