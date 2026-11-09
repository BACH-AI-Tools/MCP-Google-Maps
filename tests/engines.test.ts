import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

// Lowest major version allowed by a simple ">=X[.Y.Z]" range.
function minMajor(range: string | undefined): number {
    const m = range?.match(/>=\s*v?(\d+)/);
    return m ? Number(m[1]) : 0;
}

describe("package.json engines", () => {
    const pkg = readJson(path.join(root, "package.json"));
    const declared = minMajor(pkg.engines?.node);

    it.each(Object.keys(pkg.dependencies))(
        "node range is not lower than what runtime dependency %s requires",
        (dep) => {
            const depPkg = readJson(
                path.join(root, "node_modules", dep, "package.json")
            );
            expect(declared).toBeGreaterThanOrEqual(
                minMajor(depPkg.engines?.node)
            );
        }
    );
});
