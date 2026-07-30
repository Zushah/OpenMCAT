import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const port = Number(process.env.PORT) || 4173;

const contentTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".svg", "image/svg+xml"]
]);

const resolveRequestPath = (requestUrl = "/") => {
    const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(rootDirectory, relativePath);
    if (filePath !== rootDirectory && !filePath.startsWith(`${rootDirectory}${path.sep}`)) return null;
    return filePath;
};

const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return; }
    let filePath;
    try { filePath = resolveRequestPath(request.url); } catch { response.writeHead(400); response.end("Bad request"); return; }
    if (!filePath) { response.writeHead(403); response.end("Forbidden"); return; }
    try {
        const fileStats = await stat(filePath);
        if (!fileStats.isFile()) throw new Error("Not a file");
        response.writeHead(200, {
            "Cache-Control": "no-store",
            "Content-Length": fileStats.size,
            "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream"
        });
        if (request.method === "HEAD") response.end();
        else createReadStream(filePath).pipe(response);
    } catch { response.writeHead(404); response.end("Not found"); }
});

server.listen(port, host, () => { console.log(`OpenMCAT test server listening at http://${host}:${port}`); });

const closeServer = () => server.close(() => process.exit(0));
process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
