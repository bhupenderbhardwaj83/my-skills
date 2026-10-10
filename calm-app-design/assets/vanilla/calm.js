// Calm app design — the same behaviours as the React components, for plain HTML/JS apps.
// No dependencies. Load once:  <script src="calm.js" defer></script>  then mark up elements:
//
//   <button data-theme-toggle></button>                         light → dark → system
//   <aside data-sidebar> … <button data-sidebar-toggle> …        ⌘B / Ctrl+B, remembered
//   <div data-search-list>                                       search over a list
//     <input data-search placeholder="Search">  <ul> <li data-option>…</li> … </ul>
//   </div>
//   <div data-table data-filename="orders" data-page-size="10">  search · sort · pages · CSV
//     (rows changed by your code? call  tableDiv.calm.refresh()  afterwards)
//     <input data-search placeholder="Search rows">  <button data-csv>CSV</button>
//     <table> <thead><tr><th data-sort>Name</th><th data-sort="number">Amount</th>…</tr></thead>
//             <tbody><tr>…</tr></tbody> </table>
//     <div data-pager></div>
//   </div>
//
// Keys everywhere: / focus search · ↑↓ move · Enter open (Space too, in the list) · Esc clear/leave.
// "Open" fires a `calm:open` event on the item / row (and follows a link inside it, if any).
(function () {
  "use strict";
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const norm = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const matches = (text, q) => norm(q).split(/\s+/).filter(Boolean).every((w) => norm(text).includes(w));

  /* ── theme ── */
  const ORDER = ["light", "dark", "system"];
  const ICON = { light: "☀", dark: "☾", system: "◐" };
  function applyTheme(choice) {
    if (choice === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", choice);
    store.set("theme", choice === "system" ? null : choice);
    $$(document, "[data-theme-toggle]").forEach((b) => {
      const next = ORDER[(ORDER.indexOf(choice) + 1) % 3];
      b.textContent = ICON[choice];
      b.title = `Theme: ${choice} — switch to ${next}`;
      b.setAttribute("aria-label", b.title);
      b.dataset.choice = choice;
    });
  }
  const saved = store.get("theme");
  applyTheme(saved === "light" || saved === "dark" ? saved : "system");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-toggle]");
    if (b) applyTheme(ORDER[(ORDER.indexOf(b.dataset.choice || "system") + 1) % 3]);
  });

  /* ── sidebar ── */
  function setCollapsed(on) {
    $$(document, "[data-sidebar]").forEach((s) => s.toggleAttribute("data-collapsed", on));
    store.set("sidebar-collapsed", on ? "1" : "0");
  }
  setCollapsed(store.get("sidebar-collapsed") === "1");
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-sidebar-toggle]")) setCollapsed(!document.querySelector("[data-sidebar][data-collapsed]"));
  });

  /* ── "/" focuses the first search visible on screen ── */
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && document.querySelector("[data-sidebar]")) {
      e.preventDefault();
      setCollapsed(!document.querySelector("[data-sidebar][data-collapsed]"));
      return;
    }
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const inputs = $$(document, "input[data-search]").filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    const target = inputs[0] || document.querySelector("input[data-search]");
    if (!target) return;
    e.preventDefault();
    target.focus();
    target.select();
  });

  /* ── shared keyboard model for a search box + its items ── */
  function keyboard({ input, items, onOpen, listEl }) {
    let active = -1;
    const visible = () => items().filter((el) => !el.hidden);
    const paint = () => {
      const v = visible();
      v.forEach((el, i) => el.setAttribute("aria-selected", String(i === active)));
      v[active]?.scrollIntoView({ block: "nearest" });
    };
    const move = (d) => {
      const n = visible().length;
      active = n ? (active < 0 ? (d > 0 ? 0 : n - 1) : (active + d + n) % n) : -1;
      paint();
    };
    const open = () => { const el = visible()[active >= 0 ? active : 0]; if (el) onOpen(el); };
    const handle = (e, inList) => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" || (inList && e.key === " ")) { e.preventDefault(); open(); }
      else if (e.key === "Escape") {
        e.preventDefault();
        if (input.value) { input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); }
        else e.currentTarget.blur();
      }
    };
    input.setAttribute("role", "combobox");
    input.addEventListener("keydown", (e) => handle(e, false));
    if (listEl) {
      listEl.setAttribute("role", "listbox");
      listEl.tabIndex = 0;
      listEl.addEventListener("keydown", (e) => handle(e, true));
    }
    return {
      reset: (hasQuery) => { active = hasQuery && visible().length ? 0 : -1; paint(); },
      hover: (el) => { active = visible().indexOf(el); paint(); },
    };
  }
  const fireOpen = (el) => {
    el.dispatchEvent(new CustomEvent("calm:open", { bubbles: true }));
    const link = el.querySelector("a[href]");
    if (link) link.click();
  };

  /* ── searchable lists ── */
  $$(document, "[data-search-list]").forEach((box) => {
    const input = box.querySelector("input[data-search]");
    const items = () => $$(box, "[data-option]");
    const listEl = items()[0]?.parentElement;
    const empty = document.createElement("p");
    empty.className = "calm-empty";
    empty.hidden = true;
    listEl?.after(empty);
    const kb = keyboard({ input, items, onOpen: fireOpen, listEl });
    items().forEach((el) => {
      el.setAttribute("role", "option");
      el.addEventListener("mousemove", () => kb.hover(el));
      el.addEventListener("click", () => fireOpen(el));
    });
    input.addEventListener("input", () => {
      const q = input.value.trim();
      let shown = 0;
      items().forEach((el) => { el.hidden = Boolean(q) && !matches(el.textContent, q); shown += el.hidden ? 0 : 1; });
      empty.hidden = shown > 0;
      empty.textContent = `Nothing matches “${q}”. Try fewer or different words.`;
      kb.reset(Boolean(q));
    });
  });

  /* ── tables ── */
  $$(document, "[data-table]").forEach((box) => {
    const table = box.querySelector("table");
    const tbody = table.tBodies[0];
    const input = box.querySelector("input[data-search]");
    const pager = box.querySelector("[data-pager]");
    const heads = $$(table, "thead th");
    let all = [];
    let original = [];
    // Rows can change (add / edit / delete): call box.calm.refresh() — or dispatch "calm:refresh"
    // on the box — after changing <tbody>; search, sort and page are kept.
    const collect = () => {
      all = $$(tbody, "tr").filter((tr) => !tr.classList.contains("calm-empty-row"));
      original = all.slice();
      all.forEach((tr) => {
        if (tr.dataset.calmBound) return;
        tr.dataset.calmBound = "1";
        tr.addEventListener("click", () => fireOpen(tr));
      });
    };
    collect();
    let size = Number(box.dataset.pageSize) || 10;
    let page = 0;
    let sort = null; // { i, dir }
    const cellVal = (tr, i) => {
      const td = tr.cells[i];
      const raw = td?.dataset.value ?? td?.textContent.trim() ?? "";
      return heads[i]?.dataset.sort === "number" ? parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0 : raw;
    };
    let filtered = original.slice();
    const kb = input && keyboard({ input, items: () => $$(tbody, "tr"), onOpen: fireOpen, listEl: tbody });

    function render() {
      const q = input?.value.trim() || "";
      filtered = original.filter((tr) => !q || matches(tr.textContent, q));
      if (sort) {
        filtered.sort((a, b) => {
          const x = cellVal(a, sort.i), y = cellVal(b, sort.i);
          const r = typeof x === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
          return sort.dir === "asc" ? r : -r;
        });
      }
      const pages = Math.max(1, Math.ceil(filtered.length / size));
      page = Math.min(page, pages - 1);
      all.forEach((tr) => { tr.hidden = true; });
      const shown = filtered.slice(page * size, page * size + size);
      shown.forEach((tr) => { tr.hidden = false; tbody.appendChild(tr); });
      $$(tbody, "tr.calm-empty-row").forEach((r) => r.remove());
      if (!filtered.length) {
        const tr = tbody.insertRow();
        tr.className = "calm-empty-row";
        const td = tr.insertCell();
        td.colSpan = heads.length;
        td.textContent = q ? `No rows match “${q}”. Try fewer words, or clear the search (Esc).` : "No rows yet.";
      }
      heads.forEach((th, i) => th.setAttribute("aria-sort", sort?.i === i ? (sort.dir === "asc" ? "ascending" : "descending") : "none"));
      if (pager) {
        const from = filtered.length ? page * size + 1 : 0;
        const span = (t) => Object.assign(document.createElement("span"), { textContent: t });
        const btn = (attr, label, text, off) => {
          const b = Object.assign(document.createElement("button"), { type: "button", textContent: text, disabled: off });
          b.setAttribute(attr, ""); b.setAttribute("aria-label", label);
          return b;
        };
        pager.replaceChildren( // built from nodes — no HTML strings anywhere
          span(`${from}–${Math.min(filtered.length, (page + 1) * size)} of ${filtered.length}`),
          btn("data-prev", "Previous page", "‹", page === 0),
          span(`Page ${page + 1} / ${pages}`),
          btn("data-next", "Next page", "›", page >= pages - 1));
      }
      kb?.reset(Boolean(q));
    }

    heads.forEach((th, i) => {
      if (!th.hasAttribute("data-sort")) return;
      const b = document.createElement("button");
      b.type = "button";
      const mark = Object.assign(document.createElement("span"), { className: "calm-sort" });
      mark.setAttribute("aria-hidden", "true");
      b.append(...th.childNodes, mark); // move the nodes — never re-parse markup
      th.replaceChildren(b);
      b.addEventListener("click", () => {
        sort = !sort || sort.i !== i ? { i, dir: "asc" } : sort.dir === "asc" ? { i, dir: "desc" } : null;
        page = 0;
        render();
      });
    });
    input?.addEventListener("input", () => { page = 0; render(); });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "PageDown") { e.preventDefault(); page++; render(); }
      if (e.key === "PageUp") { e.preventDefault(); page = Math.max(0, page - 1); render(); }
    });
    pager?.addEventListener("click", (e) => {
      if (e.target.closest("[data-prev]")) page = Math.max(0, page - 1);
      else if (e.target.closest("[data-next]")) page++;
      else return;
      render();
    });
    box.calm = { refresh: () => { collect(); render(); } };
    box.addEventListener("calm:refresh", () => box.calm.refresh());
    box.querySelector("[data-csv]")?.addEventListener("click", () => {
      const cell = (s) => {
        // Formula injection guard: text starting with = + - @ tab CR gets a leading ' (numbers stay).
        if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [heads.map((th) => cell(th.textContent.trim()))]
        .concat(filtered.map((tr) => heads.map((_, i) => cell(String(tr.cells[i]?.dataset.value ?? tr.cells[i]?.textContent.trim() ?? "")))));
      const blob = new Blob(["﻿" + lines.map((l) => l.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${box.dataset.filename || "table"}.csv` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    render();
  });
})();
