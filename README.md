<div align="center">

<img src="icons/icon128.png" width="90" alt="Cookies Extractor" />

# Cookies Extractor

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-8b5cf6?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/version-1.0.0-8b5cf6?style=flat-square)](./manifest.json)
[![License](https://img.shields.io/badge/license-MIT-8b5cf6?style=flat-square)](./LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=flat-square&logo=javascript&logoColor=black)](./src/popup.js)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-34d399?style=flat-square)](https://github.com/farhaanaliii/cookies-extractor/pulls)

</div>

---

Started this for personal use — needed a quick way to grab cookies from sites without digging through devtools every time. Ended up cleaning it up and making it actually good, so here it is.

Works on any `http`/`https` page. No build step, no dependencies, no data leaving your browser.

---

## Features

- Opens popup → cookies already there, no button click
- 4 export formats: JSON, Netscape, `Cookie:` header, `key=value`
- Copy to clipboard or download as a file
- Dark / light theme toggle, both persist across sessions
- Zero dependencies — plain HTML, CSS, JS

---

## Formats

| Format | Good for |
|---|---|
| **JSON Object** | Node.js / APIs that take a `{name: {value, expires}}` map |
| **JSON Array** | Full cookie objects with all metadata (domain, path, flags) |
| **Puppeteer / Playwright** | Drop straight into `page.setCookie(...cookies)` |
| **Python Requests** | `requests.get(url, cookies={...})` |
| **Netscape** | `curl --cookie-jar`, `wget` |
| **Cookie Header** | Paste directly into a raw HTTP `Cookie:` header |
| **key=value** | One pair per line, scripts and quick manual use |
| **cURL flag** | `--cookie "name=val; ..."` append to any curl command |
| **JS Snippet** | `document.cookie = ...` lines, paste into devtools console |
| **Fetch Snippet** | Ready-to-run `fetch()` call with cookies preset |
| **Base64** | Base64-encoded JSON, useful for env vars or CLI args |
| **CSV** | `name,value,domain,path,expires,secure,httpOnly` — spreadsheet / auditing |

---

## Install

Not on the Chrome Web Store. Load it manually:

1. `git clone https://github.com/farhaanaliii/cookies-extractor.git`
2. Go to `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked** → select the repo folder
5. Done, 🍪 icon shows up in your toolbar

Firefox isn't supported yet (MV3 support is still sketchy there).

---

## Structure

```
cookies-extractor/
├── manifest.json
├── icons/
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── popup.html
    ├── popup.css
    └── popup.js
```

---

## Permissions

| Permission | Why |
|---|---|
| `cookies` | Read cookies for the active tab |
| `tabs` | Get the current tab's URL |
| `clipboardWrite` | Copy output to clipboard |
| `<all_urls>` | Access cookies across all sites |

Nothing is sent anywhere. Fully local.

---

## Technical note

Uses `chrome.cookies.getAll({ url })` with the full URL instead of just the hostname. This matters because cookies are often stored under the parent domain (`.example.com`) and a hostname-only query misses them. Passing the URL lets the browser return everything it would actually send in a real request.

---

## Contributing

Open an issue before working on anything big. For small fixes, just PR directly.

```sh
git clone https://github.com/farhaanaliii/cookies-extractor.git
# load unpacked, edit src/, reload extension
```

---

## License

[MIT](./LICENSE)
