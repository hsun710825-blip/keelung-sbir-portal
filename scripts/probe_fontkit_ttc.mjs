import fontkit from "@pdf-lib/fontkit";

const p = "C:\\Windows\\Fonts\\msjh.ttc";
const f = fontkit.openSync(p);
console.log("ctor", f?.constructor?.name);
console.log("keys", Object.keys(f || {}));
// For TTC, fontkit returns a collection with `fonts`
if (f?.fonts) {
  console.log("fonts", f.fonts.length);
  for (let i = 0; i < Math.min(5, f.fonts.length); i++) {
    const ff = f.fonts[i];
    console.log(i, {
      postscriptName: ff.postscriptName,
      fullName: ff.fullName,
      familyName: ff.familyName,
      subfamilyName: ff.subfamilyName,
      numGlyphs: ff.numGlyphs,
    });
  }
}

