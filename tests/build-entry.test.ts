import fs from "fs";
import path from "path";
import { builtinModules } from "module";

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const entry = path.join(srcDir, "index.ts");

const importRe = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;

function specifiers(file: string): string[] {
    const source = fs.readFileSync(file, "utf8");
    return [...source.matchAll(importRe)].map((m) => m[1] ?? m[2]);
}

function resolveLocal(from: string, spec: string): string {
    const base = path.resolve(path.dirname(from), spec.replace(/\.js$/, ""));
    for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`Cannot resolve ${spec} from ${from}`);
}

function listTs(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return listTs(p);
        return p.endsWith(".ts") ? [p] : [];
    });
}

function packageName(spec: string): string {
    const parts = spec.split("/");
    return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

describe("published build", () => {
    it("every source file is reachable from the build entry (src/index.ts)", () => {
        const seen = new Set<string>();
        const queue = [entry];
        while (queue.length) {
            const file = queue.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            for (const spec of specifiers(file)) {
                if (spec.startsWith(".")) queue.push(resolveLocal(file, spec));
            }
        }
        const unreachable = listTs(srcDir)
            .filter((f) => !seen.has(f) && !f.includes(`${path.sep}types${path.sep}`))
            .map((f) => path.relative(root, f));
        expect(unreachable).toEqual([]);
    });

    it("every bare import in src is a declared runtime dependency", () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
        const declared = new Set(Object.keys(pkg.dependencies ?? {}));
        const builtins = new Set(builtinModules);
        // zod is currently only available transitively via
        // @modelcontextprotocol/sdk; declaring it is tracked separately.
        const knownUndeclared = new Set(["zod"]);
        const undeclared = listTs(srcDir).flatMap((file) =>
            specifiers(file)
                .filter((s) => !s.startsWith(".") && !s.startsWith("node:"))
                .map(packageName)
                .filter(
                    (name) =>
                        !builtins.has(name) &&
                        !declared.has(name) &&
                        !knownUndeclared.has(name)
                )
                .map((name) => `${path.relative(root, file)} -> ${name}`)
        );
        expect(undeclared).toEqual([]);
    });
});
