
const url = "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2023_15cm_jp2_PG1923_jp2/MapServer?f=json";

async function check() {
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Single Fused Map Cache:", data.singleFusedMapCache);
        console.log("Spatial Reference:", JSON.stringify(data.spatialReference));
        if (data.tileInfo) {
            console.log("Tile Info Spatial Reference:", JSON.stringify(data.tileInfo.spatialReference));
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

check();
