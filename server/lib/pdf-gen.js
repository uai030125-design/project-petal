/**
 * Minimal PDF generator — zero external dependencies.
 * Supports: pages, text (Helvetica family), JPEG images, colors, rectangles.
 * Used for the Trend Scout Lookbook feature.
 */

class PDFGen {
  constructor({ width = 792, height = 612 } = {}) {
    this.width = width;   // default: US Letter landscape
    this.height = height;
    this.objects = [];
    this.pages = [];
    this.currentPage = null;
    this.fonts = {};
    this._nextObjId = 1;
    this._images = [];

    // Register standard fonts
    this.fonts['Helvetica'] = this._addObj({ Type: '/Font', Subtype: '/Type1', BaseFont: '/Helvetica' });
    this.fonts['Helvetica-Bold'] = this._addObj({ Type: '/Font', Subtype: '/Type1', BaseFont: '/Helvetica-Bold' });
    this.fonts['Helvetica-Oblique'] = this._addObj({ Type: '/Font', Subtype: '/Type1', BaseFont: '/Helvetica-Oblique' });
  }

  _addObj(dict, stream) {
    const id = this._nextObjId++;
    this.objects.push({ id, dict, stream });
    return id;
  }

  addPage() {
    this.currentPage = {
      stream: '',
      fontRefs: new Set(),
      imageRefs: [],
    };
    this.pages.push(this.currentPage);
    return this;
  }

  // ── Drawing primitives ──

  setFont(name, size) {
    const fontId = this.fonts[name] || this.fonts['Helvetica'];
    this.currentPage.fontRefs.add(name);
    this.currentPage.stream += `BT /F_${name.replace('-', '_')} ${size} Tf ET\n`;
    this._currentFont = name;
    this._currentFontSize = size;
    return this;
  }

  setColor(r, g, b) {
    // Accept 0-255 values
    this.currentPage.stream += `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg\n`;
    this.currentPage.stream += `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG\n`;
    return this;
  }

  setColorHex(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return this.setColor(r, g, b);
  }

  rect(x, y, w, h, fill = true) {
    // PDF coords: origin at bottom-left
    const py = this.height - y - h;
    this.currentPage.stream += `${x} ${py} ${w} ${h} re ${fill ? 'f' : 'S'}\n`;
    return this;
  }

  line(x1, y1, x2, y2, lineWidth = 0.5) {
    const py1 = this.height - y1;
    const py2 = this.height - y2;
    this.currentPage.stream += `${lineWidth} w ${x1} ${py1} m ${x2} ${py2} l S\n`;
    return this;
  }

  text(str, x, y, options = {}) {
    const font = this._currentFont || 'Helvetica';
    const size = this._currentFontSize || 12;
    const maxWidth = options.maxWidth || (this.width - x);
    const lineHeight = options.lineHeight || size * 1.3;
    const align = options.align || 'left';

    // Simple word wrapping
    const words = str.split(' ');
    const lines = [];
    let currentLine = '';
    const charWidth = size * 0.52; // approximate

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (testLine.length * charWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Limit lines
    const maxLines = options.maxLines || 100;
    const displayLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      displayLines[maxLines - 1] = displayLines[maxLines - 1].slice(0, -3) + '...';
    }

    for (let i = 0; i < displayLines.length; i++) {
      const line = displayLines[i];
      const py = this.height - y - (i * lineHeight);
      let tx = x;
      if (align === 'center') {
        const textW = line.length * charWidth;
        tx = x + (maxWidth - textW) / 2;
      } else if (align === 'right') {
        const textW = line.length * charWidth;
        tx = x + maxWidth - textW;
      }
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      this.currentPage.stream += `BT /F_${font.replace('-', '_')} ${size} Tf ${tx} ${py} Td (${escaped}) Tj ET\n`;
    }

    return this;
  }

  // Add JPEG image
  addImage(jpegBuffer, x, y, w, h) {
    if (!jpegBuffer || jpegBuffer.length < 100) return this;

    // Parse JPEG dimensions from header
    let imgW = w, imgH = h;
    try {
      const dims = this._parseJpegDims(jpegBuffer);
      if (dims) { imgW = dims.width; imgH = dims.height; }
    } catch {}

    const imgId = this._addObj(
      {
        Type: '/XObject',
        Subtype: '/Image',
        Width: imgW,
        Height: imgH,
        ColorSpace: '/DeviceRGB',
        BitsPerComponent: 8,
        Filter: '/DCTDecode',
        Length: jpegBuffer.length,
      },
      jpegBuffer
    );

    const imgName = `Img${this._images.length}`;
    this._images.push({ name: imgName, id: imgId });
    this.currentPage.imageRefs.push({ name: imgName, id: imgId });

    // Place image — PDF y-axis is bottom-up
    const py = this.height - y - h;
    this.currentPage.stream += `q ${w} 0 0 ${h} ${x} ${py} cm /${imgName} Do Q\n`;
    return this;
  }

  _parseJpegDims(buf) {
    // Find SOF0 or SOF2 marker
    for (let i = 0; i < buf.length - 10; i++) {
      if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        return { width, height };
      }
    }
    return null;
  }

  // ── Build final PDF ──
  toBuffer() {
    const parts = [];
    const offsets = [];

    parts.push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    // Write all pre-defined objects (fonts, images)
    for (const obj of this.objects) {
      offsets[obj.id] = Buffer.byteLength(parts.join(''), 'binary');
      parts.push(this._serializeObj(obj));
    }

    // Write page content streams & page objects
    const pageObjIds = [];
    for (const page of this.pages) {
      // Content stream
      const streamBuf = Buffer.from(page.stream, 'binary');
      const contentId = this._nextObjId++;
      offsets[contentId] = Buffer.byteLength(parts.join(''), 'binary');
      parts.push(`${contentId} 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n`);
      parts.push(page.stream);
      parts.push('\nendstream\nendobj\n');

      // Font resources
      const fontRes = [];
      for (const fname of page.fontRefs) {
        const fid = this.fonts[fname];
        if (fid) fontRes.push(`/F_${fname.replace('-', '_')} ${fid} 0 R`);
      }

      // Image resources
      const imgRes = [];
      for (const img of page.imageRefs) {
        imgRes.push(`/${img.name} ${img.id} 0 R`);
      }

      // Page object
      const pageId = this._nextObjId++;
      offsets[pageId] = Buffer.byteLength(parts.join(''), 'binary');
      let pageDict = `${pageId} 0 obj\n<< /Type /Page /MediaBox [0 0 ${this.width} ${this.height}] /Contents ${contentId} 0 R /Resources << /Font << ${fontRes.join(' ')} >>`;
      if (imgRes.length > 0) pageDict += ` /XObject << ${imgRes.join(' ')} >>`;
      pageDict += ` >> >>\nendobj\n`;
      parts.push(pageDict);
      pageObjIds.push(pageId);
    }

    // Pages object
    const pagesId = this._nextObjId++;
    offsets[pagesId] = Buffer.byteLength(parts.join(''), 'binary');
    const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
    parts.push(`${pagesId} 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>\nendobj\n`);

    // Update page parent references (already embedded inline, so skip — pages reference is via catalog)

    // Catalog
    const catalogId = this._nextObjId++;
    offsets[catalogId] = Buffer.byteLength(parts.join(''), 'binary');
    parts.push(`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`);

    // Cross-reference table
    const xrefOffset = Buffer.byteLength(parts.join(''), 'binary');
    const totalObjs = this._nextObjId;
    let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
    for (let i = 1; i < totalObjs; i++) {
      const off = offsets[i] || 0;
      xref += `${String(off).padStart(10, '0')} 00000 n \n`;
    }

    // Trailer
    xref += `trailer\n<< /Size ${totalObjs} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    parts.push(xref);

    // Combine — handle binary image data properly
    const textParts = parts.map(p => typeof p === 'string' ? Buffer.from(p, 'binary') : p);
    return Buffer.concat(textParts);
  }

  _serializeObj(obj) {
    let s = `${obj.id} 0 obj\n<<`;
    for (const [k, v] of Object.entries(obj.dict)) {
      // Skip Length from dict if stream exists — we compute it from the actual stream
      if (k === 'Length' && obj.stream) continue;
      s += ` /${k} ${v}`;
    }
    if (obj.stream) {
      const streamBytes = Buffer.isBuffer(obj.stream) ? obj.stream.length : Buffer.byteLength(obj.stream, 'binary');
      s += ` /Length ${streamBytes}`;
      s += ` >>\nstream\n`;
      // Return as parts to handle binary
      return s + (Buffer.isBuffer(obj.stream) ? obj.stream.toString('binary') : obj.stream) + '\nendstream\nendobj\n';
    }
    s += ` >>\nendobj\n`;
    return s;
  }
}

module.exports = PDFGen;
