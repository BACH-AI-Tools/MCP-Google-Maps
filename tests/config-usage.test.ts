import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");

function listTs(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return listTs(p);
        return p.endsWith(".ts") ? [p] : [];
    });
}

describe("documented configuration", () => {
    const envFile = path.join(root, "src/config/environment.ts");
    const otherSources = listTs(path.join(root, "src"))
        .filter((p) => p !== envFile)
        .map((p) => fs.readFileSync(p, "utf8"))
        .join("\n");

    it("every Config field is actually used outside the config module", () => {
        const envSource = fs.readFileSync(envFile, "utf8");
        const iface = envSource.match(/export interface Config \{([\s\S]*?)\n\}/);
        expect(iface).not.toBeNull();
        const fields = [...iface![1].matchAll(/^ {4}(\w+)\s*:/gm)].map((m) => m[1]);
        expect(fields.length).toBeGreaterThan(0);
        const unused = fields.filter((f) => !otherSources.includes(`config.${f}`));
        expect(unused).toEqual([]);
    });

    it("every variable in .env.example is read by the config module", () => {
        const envSource = fs.readFileSync(envFile, "utf8");
        const vars = fs
            .readFileSync(path.join(root, ".env.example"), "utf8")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#"))
            .map((l) => l.split("=")[0]);
        const unread = vars.filter((v) => !envSource.includes(`process.env.${v}`));
        expect(unread).toEqual([]);
    });
});
