/** Make an icon's SVG self-contained for react-native-svg on Android.
 * Paint set on the root <svg> (fill / stroke / stroke-*) is copied onto every shape element and removed from
 * the root, and currentColor becomes the real color. Root-level paint relies on inheritance through
 * the Svg→G wrapper; inside a Modal (settings sheet) that rendered nothing (0.9.10: blank back button, while
 * the ✕ icon — which carries stroke on its <path> — rendered fine). */
const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'fill-opacity', 'fill-rule'];
const SHAPES = /<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)(\/?)>/g;
export function iconXml(xml: string, color: string): string {
  const open = /<svg\b[^>]*>/.exec(xml);
  if (!open) return xml;
  const attrs: Record<string, string> = {};
  let root = open[0];
  for (const a of PAINT) {
    const m = new RegExp(`\\s${a}="([^"]*)"`).exec(root);
    if (m) { attrs[a] = m[1]; root = root.replace(m[0], ''); }
  }
  let body = xml.slice(open.index + open[0].length).replace(SHAPES, (_all, tag: string, rest: string, self: string) => {
    let add = '';
    for (const [a, v] of Object.entries(attrs)) if (!new RegExp(`\\s${a}="`).test(rest)) add += ` ${a}="${v}"`;
    return `<${tag}${rest}${add}${self}>`;
  });
  return (xml.slice(0, open.index) + root + body).replace(/currentColor/g, color);
}
