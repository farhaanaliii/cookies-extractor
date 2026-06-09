const H = (() => {

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function span(cls, raw) {
    return `<span class="t-${cls}">${esc(raw)}</span>`;
  }

  function tokenizeJSON(src) {
    let out = '';
    let i = 0;
    const len = src.length;

    function readString() {
      let s = '"';
      i++;
      while (i < len) {
        const ch = src[i++];
        s += ch;
        if (ch === '\\' && i < len) { s += src[i++]; continue; }
        if (ch === '"') break;
      }
      return s;
    }

    function readNumber() {
      let s = '';
      while (i < len && /[-\d.eE+]/.test(src[i])) s += src[i++];
      return s;
    }

    function readWord() {
      let s = '';
      while (i < len && /[a-z]/.test(src[i])) s += src[i++];
      return s;
    }

    while (i < len) {
      const ch = src[i];

      if (ch === '"') {
        const str = readString();
        let j = i;
        while (j < len && (src[j] === ' ' || src[j] === '\n' || src[j] === '\r')) j++;
        out += src[j] === ':' ? span('key', str) : span('str', str);
        continue;
      }

      if (ch === '-' || /\d/.test(ch)) { out += span('num', readNumber()); continue; }

      if (ch === 't' || ch === 'f' || ch === 'n') {
        const word = readWord();
        if (word === 'true' || word === 'false') { out += span('bool', word); continue; }
        if (word === 'null') { out += span('null', word); continue; }
        out += esc(word);
        continue;
      }

      if ('{}[],'.includes(ch)) { out += span('punct', ch); i++; continue; }
      if (ch === ':')            { out += span('colon', ch); i++; continue; }

      out += ch === '\n' ? '\n' : ch === '\r' ? '' : esc(ch);
      i++;
    }

    return out;
  }

  function tokenizeNetscape(src) {
    return src.split('\n').map(line => {
      if (line.startsWith('#')) return span('comment', line);
      if (!line.trim()) return '';

      const parts = line.split('\t');
      if (parts.length < 7) return esc(line);

      const [domain, subdom, path, secure, expires, name, ...rest] = parts;
      return [
        span('domain', domain),
        span('bool',   subdom),
        span('path',   path),
        span('bool',   secure),
        span('num',    expires),
        span('name',   name),
        span('val',    rest.join('\t')),
      ].join(span('punct', '\t'));
    }).join('\n');
  }

  function tokenizePairs(src, separator) {
    return src.split(separator).map(pair => {
      const eq = pair.indexOf('=');
      if (eq === -1) return esc(pair);
      return span('name', pair.slice(0, eq))
           + span('op',   '=')
           + span('val',  pair.slice(eq + 1));
    }).join(span('sep', separator));
  }

  function tokenizeCurl(src) {
    const m = src.match(/^(--cookie)\s+(")([\s\S]*)(")\s*$/);
    if (!m) return esc(src);
    return span('flag', m[1]) + ' ' + span('punct', '"') + tokenizePairs(m[3], '; ') + span('punct', '"');
  }

  function tokenizeJS(src) {
    const KEYWORDS = new Set([
      'const','let','var','function','return','if','else','for','while',
      'new','this','typeof','true','false','null','undefined','async','await',
    ]);
    const BUILTINS = new Set([
      'document','window','fetch','console','Promise','JSON',
      'headers','method','body','credentials','mode',
    ]);

    let out = '';
    let i = 0;
    const len = src.length;

    function readString(quote) {
      let s = quote;
      i++;
      while (i < len) {
        const ch = src[i++];
        s += ch;
        if (ch === '\\' && i < len) { s += src[i++]; continue; }
        if (ch === quote) break;
      }
      return s;
    }

    function readTemplate() {
      let s = '`';
      i++;
      while (i < len) {
        const ch = src[i++];
        s += ch;
        if (ch === '\\' && i < len) { s += src[i++]; continue; }
        if (ch === '`') break;
      }
      return s;
    }

    function readIdent() {
      let s = '';
      while (i < len && /[\w$]/.test(src[i])) s += src[i++];
      return s;
    }

    while (i < len) {
      const ch = src[i];

      if (ch === '/' && src[i + 1] === '/') {
        i += 2;
        let comment = '';
        while (i < len && src[i] !== '\n') comment += src[i++];
        out += span('comment', '//' + comment);
        continue;
      }

      if (ch === '"' || ch === "'") { out += span('str', readString(ch)); continue; }
      if (ch === '`')               { out += span('str', readTemplate()); continue; }

      if (/[a-zA-Z_$]/.test(ch)) {
        const word = readIdent();
        if (KEYWORDS.has(word))      out += span('kw',      word);
        else if (BUILTINS.has(word)) out += span('builtin', word);
        else                          out += span('ident',   word);

        if (src[i] === '.') {
          out += span('punct', '.');
          i++;
          const prop = readIdent();
          if (prop) out += span('prop', prop);
        }
        continue;
      }

      if (/\d/.test(ch)) {
        let num = '';
        while (i < len && /[\d.eE+\-x]/.test(src[i])) num += src[i++];
        out += span('num', num);
        continue;
      }

      if ('(){}[];,'.includes(ch)) { out += span('punct', ch); i++; continue; }
      if (ch === ':') { out += span('colon', ch); i++; continue; }
      if (ch === '=') { out += span('op',    ch); i++; continue; }

      out += ch === '\n' ? '\n' : esc(ch);
      i++;
    }

    return out;
  }

  function tokenizePython(src) {
    const KEYWORDS = new Set([
      'def','return','import','from','as','if','else','for','in',
      'True','False','None','with','class',
    ]);
    const BUILTINS = new Set(['requests','cookies','get','post','session','Session','print']);

    let out = '';
    let i = 0;
    const len = src.length;

    function readString(quote) {
      let s = quote;
      i += quote.length;
      while (i < len) {
        const ch = src[i++];
        s += ch;
        if (ch === '\\' && i < len) { s += src[i++]; continue; }
        if (s.endsWith(quote) && s.length > quote.length) break;
      }
      return s;
    }

    function readIdent() {
      let s = '';
      while (i < len && /\w/.test(src[i])) s += src[i++];
      return s;
    }

    while (i < len) {
      const ch = src[i];

      if (ch === '#') {
        i++;
        let comment = '';
        while (i < len && src[i] !== '\n') comment += src[i++];
        out += span('comment', '#' + comment);
        continue;
      }

      if (ch === '"' || ch === "'") {
        const triple = src.slice(i, i + 3);
        out += span('str', (triple === '"""' || triple === "'''") ? readString(triple) : readString(ch));
        continue;
      }

      if (/[a-zA-Z_]/.test(ch)) {
        const word = readIdent();
        if (KEYWORDS.has(word))      out += span('kw',      word);
        else if (BUILTINS.has(word)) out += span('builtin', word);
        else                          out += span('ident',   word);
        continue;
      }

      if (/\d/.test(ch)) {
        let num = '';
        while (i < len && /[\d._eE+\-]/.test(src[i])) num += src[i++];
        out += span('num', num);
        continue;
      }

      if ('(){}[],'.includes(ch)) { out += span('punct', ch); i++; continue; }
      if (ch === ':') { out += span('colon', ch); i++; continue; }
      if (ch === '=') { out += span('op',    ch); i++; continue; }

      out += ch === '\n' ? '\n' : esc(ch);
      i++;
    }

    return out;
  }

  function tokenizeCSV(src) {
    return src.split('\n').map((line, rowIdx) => {
      const fields = [];
      let field = '';
      let inQuote = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { field += '"'; i++; }
          else inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          fields.push(field); field = '';
        } else {
          field += ch;
        }
      }
      fields.push(field);

      if (rowIdx === 0) {
        return fields.map(f => span('header', f)).join(span('punct', ','));
      }

      return fields.map((f, ci) => {
        const clean = f.replace(/^"|"$/g, '').replace(/""/g, '"');
        switch (ci) {
          case 0: return span('name',   clean);
          case 1: return span('val',    clean);
          case 2: return span('domain', clean);
          case 3: return span('path',   clean);
          case 4: return clean ? span('num', clean) : span('null', '');
          case 5:
          case 6: return span('bool', clean);
          default: return esc(clean);
        }
      }).join(span('punct', ','));
    }).join('\n');
  }

  return {
    json:     tokenizeJSON,
    netscape: tokenizeNetscape,
    header:   s => tokenizePairs(s, '; '),
    keyval:   s => tokenizePairs(s, '\n'),
    curl:     tokenizeCurl,
    js:       tokenizeJS,
    python:   tokenizePython,
    csv:      tokenizeCSV,
    base64:   s => span('b64', s),
  };

})();
