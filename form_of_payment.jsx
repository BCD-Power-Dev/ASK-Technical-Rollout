/**
 * Form of Payment Manager - ToolJet Custom Component
 * Version: 7.5 (Consolidated Multi-Instance)
 *
 * Changes from v7.4:
 * - ONE dispatcher (handle_fop_action) handles all instances and all actions
 * - ONE set of three SQL queries (insert/update/delete) serves every tab
 * - Component triggers the shared dispatcher; dispatcher uses instanceId
 *   from the payload to look up the firing component, then stages the
 *   payload into the page variable fop_current_payload that SQL reads from
 * - For each new tab: just add the component name to the dispatcher's
 *   INSTANCES array. No SQL or handler duplication.
 *
 * REQUIRED PAGE VARIABLES:
 *   fop_current_payload  (default: {})  — dispatcher writes payload here
 *   last_fop_ts          (default: 0)   — idempotency guard for re-triggers
 *
 * Data binding contract (per instance):
 *   {{({
 *     fopRecords:           queries.postgresql_get_all_fops.data,
 *     smidOptions:          queries.postgresql_get_smids.data,
 *     lcnOptions:           queries.postgresql_get_lcns.data,
 *     categoryOptions:      queries.postgresql_get_categories.data,
 *     travelerTypeOptions:  queries.postgresql_get_traveler_types.data,
 *     filterCategory:       "Air",                              // or null
 *     filterTravelerType:   page.variables.var_selected_traveler // or null
 *     instanceId:           "fop_air_tab",
 *     currentUser:          globals.currentUser.firstName,
 *     userGroups:           globals.currentUser.groups,
 *     _refresh:             page.variables.var_policy_refresh_key || 0
 *   })}}
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';

// =============================================================================
// CONSTANTS
// =============================================================================

// Predefined colors for well-known category titles (kept for visual consistency).
// Any title not found here is assigned a stable color from the fallback palette
// via a deterministic hash, so new rows in ref_travel_categories Just Work.
var CATEGORY_COLORS = {
  "Air":       { bg: "#dbeafe", fg: "#1e40af" },
  "Rail":      { bg: "#fce7f3", fg: "#9d174d" },
  "Car":       { bg: "#d1fae5", fg: "#065f46" },
  "Hotel":     { bg: "#fef3c7", fg: "#92400e" },
  "Ground":    { bg: "#e0e7ff", fg: "#3730a3" },
  "Ferry":     { bg: "#cffafe", fg: "#155e75" },
  "Taxi/Limo": { bg: "#f3e8ff", fg: "#6b21a8" },
};

var FALLBACK_PALETTE = [
  { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#d1fae5", fg: "#065f46" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#e0e7ff", fg: "#3730a3" },
  { bg: "#cffafe", fg: "#155e75" },
  { bg: "#f3e8ff", fg: "#6b21a8" },
  { bg: "#fed7aa", fg: "#9a3412" },
  { bg: "#bbf7d0", fg: "#166534" },
  { bg: "#bae6fd", fg: "#0c4a6e" },
  { bg: "#fbcfe8", fg: "#831843" },
  { bg: "#ddd6fe", fg: "#5b21b6" },
];

function hashString(str) {
  var hash = 0;
  if (!str) return 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

var getCatColor = function(cat) {
  if (!cat) return { bg: "#f1f5f9", fg: "#475569" };
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  return FALLBACK_PALETTE[hashString(cat) % FALLBACK_PALETTE.length];
};

var FOP_FIELDS = [
  { key: "air",              label: "Air",              sk: "editAir" },
  { key: "hotel",            label: "Hotel",            sk: "editHotel" },
  { key: "car",              label: "Car",              sk: "editCar" },
  { key: "rail",             label: "Rail",             sk: "editRail" },
  { key: "other",            label: "Other",            sk: "editOther" },
  { key: "non_gds_carriers", label: "Non-GDS Carriers", sk: "editNonGds" },
  { key: "non_profiled",     label: "Non-Profiled",     sk: "editNonProfiled" },
];

// =============================================================================
// UTILITIES
// =============================================================================

function parsePgArray(val) {
  if (val === null || val === undefined || val === '') return [];
  if (Array.isArray(val)) return val.map(function(s) { return String(s).trim(); }).filter(Boolean);
  var s = String(val).trim();
  if (s === '{}' || s === '') return [];
  // Strip outer braces if present
  if (s.charAt(0) === '{' && s.charAt(s.length - 1) === '}') {
    s = s.slice(1, -1);
  }
  // Split on commas not inside quotes, then strip quotes/whitespace
  var out = [];
  var cur = '';
  var inQuote = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '"' && s.charAt(i - 1) !== '\\') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function extractQueryData(queryResult) {
  if (!queryResult) return [];
  if (Array.isArray(queryResult)) return queryResult;
  if (queryResult.data && Array.isArray(queryResult.data)) return queryResult.data;
  if (queryResult.rawData && Array.isArray(queryResult.rawData)) return queryResult.rawData;
  if (typeof queryResult === 'object' && queryResult.id) return [queryResult];
  return [];
}

// =============================================================================
// THEME
// =============================================================================

var C = {
  primary: '#4f46e5',
  primaryLight: '#e0e7ff',
  bg: '#ffffff',
  bgAlt: '#f9fafb',
  bgHover: '#f3f4f6',
  border: '#e2e8f0',
  text: '#334155',
  textDark: '#0f172a',
  textMuted: '#94a3b8',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
};

// =============================================================================
// ICONS
// =============================================================================

var Icons = {
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  bold: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
  italic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  underline: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
  list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>',
  listOrdered: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="9" font-size="9" fill="currentColor" stroke="none">1</text><text x="1" y="15" font-size="9" fill="currentColor" stroke="none">2</text><text x="1" y="21" font-size="9" fill="currentColor" stroke="none">3</text></svg>',
  indent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="3"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="15" x2="21" y2="15"/><line x1="3" y1="21" x2="21" y2="21"/><polyline points="3 15 7 12 3 9"/></svg>',
  outdent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="3"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="15" x2="21" y2="15"/><line x1="3" y1="21" x2="21" y2="21"/><polyline points="7 9 3 12 7 15"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
};

function Icon(name, color) {
  return <span style={{ display: 'inline-flex', color: color || 'currentColor' }} dangerouslySetInnerHTML={{ __html: Icons[name] || '' }} />;
}

// =============================================================================
// RICH TEXT EDITOR
// =============================================================================

class RichTextEditor extends React.Component {
  constructor(props) {
    super(props);
    this.editorRef = React.createRef();
  }

  componentDidMount() {
    if (this.editorRef.current && this.props.value) {
      this.editorRef.current.innerHTML = this.props.value;
    }
  }

  componentDidUpdate(pp) {
    if (pp.value !== this.props.value && this.editorRef.current && this.editorRef.current.innerHTML !== this.props.value) {
      this.editorRef.current.innerHTML = this.props.value || "";
    }
  }

  execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val || null);
    if (this.editorRef.current) this.editorRef.current.focus();
    this.fireChange();
  }

  fireChange = () => {
    if (this.editorRef.current && this.props.onChange) {
      this.props.onChange(this.editorRef.current.innerHTML);
    }
  }

  handleLink = () => {
    var url = prompt("Enter URL:");
    if (url) this.execCmd("createLink", url);
  }

  render() {
    var self = this;
    var tb = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid transparent", borderRadius: "4px", background: "transparent", cursor: "pointer", color: "#475569", fontSize: "13px", fontWeight: 600, padding: 0 };
    var prevent = function(e) { e.preventDefault(); };
    var sep = <span style={{ width: "1px", height: "20px", background: C.border, margin: "0 4px" }} />;

    return (
      <div style={{ border: "1px solid " + C.border, borderRadius: "6px", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", padding: "6px 8px", borderBottom: "1px solid " + C.border, background: C.bgAlt, alignItems: "center" }}>
          <button style={tb} title="Bold" onMouseDown={prevent} onClick={() => self.execCmd("bold")}>{Icon('bold')}</button>
          <button style={tb} title="Italic" onMouseDown={prevent} onClick={() => self.execCmd("italic")}>{Icon('italic')}</button>
          <button style={tb} title="Underline" onMouseDown={prevent} onClick={() => self.execCmd("underline")}>{Icon('underline')}</button>
          {sep}
          <button style={tb} title="Bullet List" onMouseDown={prevent} onClick={() => self.execCmd("insertUnorderedList")}>{Icon('list')}</button>
          <button style={tb} title="Numbered List" onMouseDown={prevent} onClick={() => self.execCmd("insertOrderedList")}>{Icon('listOrdered')}</button>
          {sep}
          <button style={tb} title="Indent" onMouseDown={prevent} onClick={() => self.execCmd("indent")}>{Icon('indent')}</button>
          <button style={tb} title="Outdent" onMouseDown={prevent} onClick={() => self.execCmd("outdent")}>{Icon('outdent')}</button>
          {sep}
          <button style={tb} title="Link" onMouseDown={prevent} onClick={() => self.handleLink()}>{Icon('link')}</button>
        </div>
        <div
          ref={this.editorRef}
          contentEditable={true}
          style={{ flex: 1, padding: "10px 12px", outline: "none", overflowY: "auto", minHeight: "200px", fontSize: "13px", lineHeight: "1.65", color: C.textDark, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}
          onInput={this.fireChange}
        />
      </div>
    );
  }
}

// =============================================================================
// NOTES DISPLAY
// =============================================================================

function NotesDisplay({ html, style }) {
  if (!html || html.trim() === "" || html.trim() === "<p></p>") {
    return <div style={{ color: C.textMuted, fontStyle: "italic" }}>No notes available.</div>;
  }
  var styled = '<style>.fn ul,.fn ol{padding-left:22px;margin:4px 0}.fn li{margin-bottom:3px}.fn a{color:#4f46e5;text-decoration:none}.fn a:hover{text-decoration:underline}.fn strong,.fn b{font-weight:600;color:#0f172a}.fn p{margin:4px 0}</style><div class="fn">' + html + '</div>';
  return <div style={style || {}} dangerouslySetInnerHTML={{ __html: styled }} />;
}

// =============================================================================
// CATEGORY SELECT (now driven by dynamic categories list)
// =============================================================================

function CatSelect({ selected = [], onChange, fieldLabelStyle, categories = [] }) {
  var allOn = categories.length > 0 && selected.length === categories.length;

  var toggle = function(cat) {
    var idx = selected.indexOf(cat);
    if (idx >= 0) onChange(selected.filter(function(_, i) { return i !== idx; }));
    else onChange([].concat(selected, [cat]));
  };

  if (categories.length === 0) {
    return (
      <div>
        <div style={fieldLabelStyle}>Categories</div>
        <div style={{ marginTop: "4px", fontSize: "12px", color: C.textMuted, fontStyle: "italic" }}>
          No categories available. Verify the postgresql_get_categories query is loaded.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={fieldLabelStyle}>Categories</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
        <button
          onClick={() => allOn ? onChange([]) : onChange([].concat(categories))}
          style={{ display: "inline-flex", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 500, border: allOn ? "2px solid " + C.primary : "1px solid " + C.border, background: allOn ? C.primaryLight : C.bg, color: allOn ? C.primary : C.textMuted, cursor: "pointer" }}
        >All</button>
        {categories.map(function(cat) {
          var isOn = selected.indexOf(cat) >= 0;
          var cc = getCatColor(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              style={{ display: "inline-flex", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 500, border: isOn ? "2px solid " + cc.fg : "1px solid " + C.border, background: isOn ? cc.bg : C.bg, color: isOn ? cc.fg : C.textMuted, cursor: "pointer", opacity: isOn ? 1 : 0.7 }}
            >{cat}</button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// TRAVELER TYPE SELECT (multi-select checkbox grid)
// =============================================================================

function TravelerTypeSelect({ selected = [], onChange, options = [], fieldLabelStyle }) {
  if (!options || options.length === 0) {
    return (
      <div style={CS.section}>
        <div style={CS.header}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>Traveler Types</span>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>
          No traveler types available. Verify the postgresql_get_traveler_types query is loaded.
        </div>
      </div>
    );
  }

  var toggle = function(opt) {
    var idx = selected.indexOf(opt);
    if (idx >= 0) onChange(selected.filter(function(_, i) { return i !== idx; }));
    else onChange([].concat(selected, [opt]));
  };

  var selectAll = function() { onChange([].concat(options)); };
  var clearAll  = function() { onChange([]); };

  // Reuses SMID/LCN grid styles with amber accent for traveler-type visual identity.
  var headerLabelTt = { fontSize: '12px', fontWeight: 600, color: '#92400e' };
  var btnTt         = { fontSize: '11px', color: '#92400e', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontWeight: 500 };
  var tagSelTt      = { backgroundColor: '#fef3c7', borderColor: '#92400e' };

  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={headerLabelTt}>Traveler Types ({selected.length}/{options.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={btnTt} onClick={selectAll}>Select All</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={btnTt} onClick={clearAll}>Clear</button>
        </div>
      </div>
      <div style={CS.grid}>
        {options.map(function(opt) {
          var isSel = selected.indexOf(opt) >= 0;
          return (
            <div key={opt} style={Object.assign({}, CS.tag, isSel ? tagSelTt : {})} onClick={function() { toggle(opt); }}>
              <span style={CS.checkbox(isSel, '#92400e')}>
                {isSel ? <span style={CS.checkmark}>✓</span> : null}
              </span>
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// SMID / LCN SELECTORS (unchanged from v5)
// =============================================================================

var CS = {
  section: { marginTop: '8px', marginBottom: '8px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e2e8f0' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  headerLabel: { fontSize: '12px', fontWeight: 600, color: '#3b82f6' },
  headerLabelLcn: { fontSize: '12px', fontWeight: 600, color: '#8b5cf6' },
  headerActions: { display: 'flex', gap: '4px', alignItems: 'center' },
  selectAllBtn: { fontSize: '11px', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontWeight: 500 },
  selectAllBtnLcn: { fontSize: '11px', color: '#8b5cf6', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontWeight: 500 },
  sep: { margin: '0 4px', color: '#94a3b8', fontSize: '11px' },
  grid: { display: 'flex', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto' },
  tag: { display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: '12px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginRight: '8px', marginBottom: '8px', cursor: 'pointer' },
  tagSelSmid: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  tagSelLcn: { backgroundColor: '#f5f3ff', borderColor: '#8b5cf6' },
  checkbox: (sel, color) => ({
    width: '14px', height: '14px', borderRadius: '3px', marginRight: '6px',
    border: '2px solid ' + (sel ? color : '#e2e8f0'),
    backgroundColor: sel ? color : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0
  }),
  checkmark: { color: '#fff', fontSize: '10px' },
  countryTag: { marginLeft: '4px', fontSize: '10px', color: '#94a3b8' },
};

function SmidSelector({ smidOptions, selSmids, setSelSmids }) {
  // Hooks must run before any early return (Rules of Hooks).
  var [smidSearch, setSmidSearch] = useState('');

  var filteredSmids = useMemo(function() {
    if (!smidOptions || !smidSearch) return smidOptions || [];
    var q = smidSearch.toLowerCase();
    return smidOptions.filter(function(s) {
      return String(s.smid || '').toLowerCase().indexOf(q) >= 0 ||
             String(s.title || '').toLowerCase().indexOf(q) >= 0 ||
             String(s.country_a2 || '').toLowerCase().indexOf(q) >= 0;
    });
  }, [smidOptions, smidSearch]);

  if (!smidOptions || smidOptions.length === 0) return null;

  var toggleSmid = function(id) {
    var sid = String(id);
    setSelSmids(function(prev) {
      return prev.indexOf(sid) >= 0
        ? prev.filter(function(x) { return x !== sid; })
        : [].concat(prev, [sid]);
    });
  };

  var selectAll = function() { setSelSmids(smidOptions.map(function(s) { return String(s.smid); })); };
  var selectVisible = function() {
    setSelSmids(function(prev) {
      var visIds = filteredSmids.map(function(s) { return String(s.smid); });
      var merged = [].concat(prev);
      visIds.forEach(function(id) { if (merged.indexOf(id) < 0) merged.push(id); });
      return merged;
    });
  };
  var clearAll = function() { setSelSmids([]); };

  var searchInputStyle = {
    width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid ' + C.border,
    borderRadius: 4, marginBottom: 8, outline: 'none', background: C.bg, color: C.text,
    boxSizing: 'border-box'
  };

  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={CS.headerLabel}>SMID ({selSmids.length}/{smidOptions.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={CS.selectAllBtn} onClick={selectAll}>All</button>
          <span style={CS.sep}>|</span>
          {smidSearch ? (
            <>
              <button type="button" style={CS.selectAllBtn} onClick={selectVisible} title="Add all currently visible to selection">Visible</button>
              <span style={CS.sep}>|</span>
            </>
          ) : null}
          <button type="button" style={CS.selectAllBtn} onClick={clearAll}>Clear</button>
        </div>
      </div>
      <input
        type="text"
        placeholder={"Search " + smidOptions.length + " SMIDs..."}
        value={smidSearch}
        onChange={function(e) { setSmidSearch(e.target.value); }}
        style={searchInputStyle}
      />
      <div style={CS.grid}>
        {filteredSmids.length === 0 ? (
          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', padding: '4px 0' }}>
            No SMIDs match "{smidSearch}".
          </div>
        ) : filteredSmids.map(function(s) {
          var sid = String(s.smid);
          var isSel = selSmids.indexOf(sid) >= 0;
          return (
            <div key={sid} style={Object.assign({}, CS.tag, isSel ? CS.tagSelSmid : {})} onClick={function() { toggleSmid(s.smid); }}>
              <span style={CS.checkbox(isSel, '#3b82f6')}>
                {isSel ? <span style={CS.checkmark}>✓</span> : null}
              </span>
              {s.title || sid}
              {s.country_a2 ? <span style={CS.countryTag}>({s.country_a2})</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LcnSelector({ lcnOptions, selLcns, setSelLcns }) {
  if (!lcnOptions || lcnOptions.length === 0) return null;

  var toggleLcn = function(id) {
    var lid = String(id);
    setSelLcns(function(prev) {
      return prev.indexOf(lid) >= 0
        ? prev.filter(function(x) { return x !== lid; })
        : [].concat(prev, [lid]);
    });
  };

  var getLcnKey = function(l) { return String(l.lcn_number || l.lcn || l.lcn_name || ''); };
  var getLcnLabel = function(l) { return l.lcn_name || l.lcn_number || l.lcn || ''; };

  var selectAll = function() { setSelLcns(lcnOptions.map(getLcnKey)); };
  var clearAll = function() { setSelLcns([]); };

  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={CS.headerLabelLcn}>LCN ({selLcns.length}/{lcnOptions.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={CS.selectAllBtnLcn} onClick={selectAll}>Select All</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={CS.selectAllBtnLcn} onClick={clearAll}>Clear</button>
        </div>
      </div>
      <div style={CS.grid}>
        {lcnOptions.map(function(l, i) {
          var lid = getLcnKey(l);
          var isSel = selLcns.indexOf(lid) >= 0;
          return (
            <div key={lid || i} style={Object.assign({}, CS.tag, isSel ? CS.tagSelLcn : {})} onClick={function() { toggleLcn(lid); }}>
              <span style={CS.checkbox(isSel, '#8b5cf6')}>
                {isSel ? <span style={CS.checkmark}>✓</span> : null}
              </span>
              {getLcnLabel(l)}
              {l.smid_country_a2 ? <span style={CS.countryTag}>({l.smid_country_a2})</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// ERROR BOUNDARY
// =============================================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  componentDidCatch(error) {
    this.setState({ hasError: true, error: error });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "16px", fontFamily: "monospace", fontSize: "12px", background: "#fef2f2", color: "#991b1b", borderRadius: "8px", border: "1px solid #fecaca", height: "100%", overflowY: "auto" }}>
          <div style={{ fontWeight: 700, marginBottom: "8px" }}>FOP Manager Error</div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function FopManager(props) {
  var data = props.data || {};
  var updateData = props.updateData;

  // ─── Dispatcher trigger ───
  // ToolJet custom components don't expose "Data updated" events in this
  // version, so the component triggers the handler query directly. Matches
  // the working pattern in PolicyManager / addAirParentTopic.
  var triggerDispatcher = function(queryName) {
    var fn = props.runQuery || props.runJsQuery || (props.actions && props.actions.runQuery);
    if (typeof fn === 'function') {
      try { fn(queryName); } catch (e) { console.error('[FOP] triggerDispatcher error:', e); }
    } else {
      console.warn('[FOP] No runQuery prop found. Available props:', Object.keys(props));
    }
  };

  // One-time props inspection — remove after wiring is verified
  useEffect(function() {
    console.log('[FOP props keys]', Object.keys(props));
    console.log('[FOP has runQuery]', typeof props.runQuery);
    console.log('[FOP has runJsQuery]', typeof props.runJsQuery);
    console.log('[FOP has actions]', typeof props.actions);
  }, []);

  // ─── Permission check ───
  var EDITOR_GROUPS = ['admin', 'builder', 'Content_Editor'];
  var userGroups = useMemo(function() {
    var groups = data.userGroups;
    if (Array.isArray(groups)) return groups;
    if (typeof groups === 'string') return [groups];
    return [];
  }, [data.userGroups]);
  var hasEditPermission = useMemo(function() {
    return userGroups.some(function(g) {
      return EDITOR_GROUPS.indexOf(g) >= 0;
    });
  }, [userGroups]);

  // ─── State ───
  var [selectedFop, setSelectedFop] = useState(null);
  var [isEditing, setIsEditing] = useState(false);
  var [isAdding, setIsAdding] = useState(false);
  var [searchTerm, setSearchTerm] = useState("");
  var [editNotes, setEditNotes] = useState("");
  var [editSummary, setEditSummary] = useState("");
  var [editCats, setEditCats] = useState([]);
  var [editSmids, setEditSmids] = useState([]);
  var [editLcns, setEditLcns] = useState([]);
  var [editTravelerTypes, setEditTravelerTypes] = useState([]);
  var [editFields, setEditFields] = useState({});

  // ─── Data extraction ───
  var fopRecords = useMemo(function() {
    return extractQueryData(data.fopRecords);
  }, [data.fopRecords]);

  var smidOptions = useMemo(function() {
    return Array.isArray(data.smidOptions) ? data.smidOptions : [];
  }, [data.smidOptions]);

  var lcnOptions = useMemo(function() {
    return Array.isArray(data.lcnOptions) ? data.lcnOptions : [];
  }, [data.lcnOptions]);

  // categoryOptions comes from ref_travel_categories: [{id, title}, ...]
  // We surface the title list for the UI; ids stay in the source data if needed later.
  var categoryList = useMemo(function() {
    var raw = extractQueryData(data.categoryOptions);
    return raw.map(function(c) {
      if (typeof c === 'string') return c;
      return c.title || c.name || '';
    }).filter(Boolean);
  }, [data.categoryOptions]);

  // travelerTypeOptions: try common shapes — string array, or [{name|title|traveler_type}, ...]
  var travelerTypeList = useMemo(function() {
    var raw = extractQueryData(data.travelerTypeOptions);
    return raw.map(function(t) {
      if (typeof t === 'string') return t;
      return t.traveler_type || t.name || t.title || t.traveler_type_name || '';
    }).filter(Boolean);
  }, [data.travelerTypeOptions]);

  // Per-instance filter context — drives client-side filtering
  var filterCategory = useMemo(function() {
    var v = data.filterCategory;
    return (v === undefined || v === null || v === '') ? null : String(v).trim();
  }, [data.filterCategory]);

  var filterTravelerType = useMemo(function() {
    var v = data.filterTravelerType;
    if (v === undefined || v === null) return null;
    var s = String(v).replace(/\*\*/g, "").trim();
    return s === '' ? null : s;
  }, [data.filterTravelerType]);

  // ─── Filtered records (category + traveler_type + search, all client-side) ───
  var filtered = useMemo(function() {
    var rows = fopRecords;

    if (filterCategory) {
      rows = rows.filter(function(r) {
        // Defensive: handle array literal "{Air,Car}", JS array, OR plain
        // string "Air" in legacy rows.
        var cats = parsePgArray(r.category);
        if (cats.length > 0) return cats.indexOf(filterCategory) >= 0;
        // Fallback for plain-string legacy values
        return String(r.category || '').trim() === filterCategory;
      });
    }

    if (filterTravelerType) {
      rows = rows.filter(function(r) {
        var tts = parsePgArray(r.traveler_type);
        if (tts.length > 0) return tts.indexOf(filterTravelerType) >= 0;
        return String(r.traveler_type || '').replace(/\*\*/g, '').trim() === filterTravelerType;
      });
    }

    if (searchTerm) {
      var lower = searchTerm.toLowerCase();
      rows = rows.filter(function(r) {
        return (r.payment_summary || "").toLowerCase().indexOf(lower) >= 0 ||
               (r.notes || "").toLowerCase().indexOf(lower) >= 0;
      });
    }

    return rows;
  }, [fopRecords, filterCategory, filterTravelerType, searchTerm]);

  // ─── Auto-select first record / keep selection valid ───
  useEffect(function() {
    if (filtered.length > 0 && !selectedFop) {
      setSelectedFop(filtered[0]);
    } else if (filtered.length > 0 && selectedFop && !filtered.some(function(r) { return r.id === selectedFop.id; })) {
      setSelectedFop(filtered[0]);
    } else if (filtered.length === 0) {
      setSelectedFop(null);
    }
  }, [filtered]);

  // ─── Handlers ───
  function handleSelect(rec) {
    setSelectedFop(rec);
    setIsEditing(false);
    setIsAdding(false);
  }

  function handleEdit() {
    if (!selectedFop) return;
    setEditNotes(selectedFop.notes || "");
    setEditSummary(selectedFop.payment_summary || "");
    setEditCats(parsePgArray(selectedFop.category));
    setEditSmids(parsePgArray(selectedFop.smid));
    setEditLcns(parsePgArray(selectedFop.lcn));
    setEditTravelerTypes(parsePgArray(selectedFop.traveler_type));
    var fields = {};
    FOP_FIELDS.forEach(function(f) { fields[f.sk] = selectedFop[f.key] || ""; });
    setEditFields(fields);
    setIsEditing(true);
    setIsAdding(false);
  }

  function handleAdd() {
    setIsAdding(true);
    setIsEditing(false);
    setSelectedFop(null);
    setEditNotes("");
    setEditSummary("");
    // Pre-fill from the instance's filter context so a new row lands in the
    // current view by default.
    setEditCats(filterCategory ? [filterCategory] : []);
    setEditSmids([]);
    setEditLcns([]);
    setEditTravelerTypes(filterTravelerType ? [filterTravelerType] : []);
    var fields = {};
    FOP_FIELDS.forEach(function(f) { fields[f.sk] = ""; });
    setEditFields(fields);
  }

  function handleSave() {
    var payload = {
      payment_summary: editSummary,
      notes: editNotes,
      category: editCats.length > 0 ? "{" + editCats.join(",") + "}" : "{}",
      smid: editSmids.length > 0 ? "{" + editSmids.join(", ") + "}" : "{}",
      lcn: editLcns.length > 0 ? "{" + editLcns.join(", ") + "}" : "",
      traveler_type: editTravelerTypes.length > 0 ? "{" + editTravelerTypes.join(",") + "}" : "{}",
      updated_by: data.currentUser || "",
    };
    FOP_FIELDS.forEach(function(f) { payload[f.key] = editFields[f.sk] || ""; });

    var actionData = null;
    if (isAdding) {
      actionData = { action: "add", payload: payload, instanceId: data.instanceId || null, ts: Date.now() };
    } else if (isEditing && selectedFop) {
      payload.id = selectedFop.id;
      payload.form_of_payment_idx = selectedFop.form_of_payment_idx;
      actionData = { action: "edit", payload: payload, instanceId: data.instanceId || null, ts: Date.now() };
    }

    if (actionData && updateData) {
      updateData(actionData);
      // Single shared dispatcher — reads instanceId from payload, looks up
      // the firing component dynamically, stages payload into a page
      // variable that the SQL queries read from.
      setTimeout(function() { triggerDispatcher('handle_fop_action'); }, 50);
    }

    setIsEditing(false);
    setIsAdding(false);
  }

  function handleCancel() {
    setIsEditing(false);
    setIsAdding(false);
  }

  function handleDelete() {
    if (!selectedFop) return;
    var label = selectedFop.payment_summary || ('record #' + selectedFop.id);
    var ok = window.confirm('Delete "' + label + '"?\n\nThis cannot be undone.');
    if (!ok) return;
    if (updateData) {
      updateData({
        action: 'delete',
        payload: {
          id: selectedFop.id,
          form_of_payment_idx: selectedFop.form_of_payment_idx,
          payment_summary: selectedFop.payment_summary
        },
        instanceId: data.instanceId || null,
        ts: Date.now()
      });
      setTimeout(function() { triggerDispatcher('handle_fop_action'); }, 50);
    }
    setIsEditing(false);
    setIsAdding(false);
    setSelectedFop(null);
  }

  // ─── Styles ───
  var S = {
    root: { display: "flex", flexDirection: "column", height: "100%", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: "13px", color: C.text, background: C.bg, overflow: "hidden" },
    hdr: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid " + C.border, background: C.bgAlt, minHeight: "40px" },
    body: { display: "flex", flex: 1, overflow: "hidden" },
    lp: { width: "220px", minWidth: "180px", borderRight: "1px solid " + C.border, display: "flex", flexDirection: "column", background: C.bgAlt },
    sb: { padding: "8px 10px", borderBottom: "1px solid " + C.border },
    si: { width: "100%", padding: "6px 10px", border: "1px solid " + C.border, borderRadius: "6px", fontSize: "12px", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box" },
    lc: { flex: 1, overflowY: "auto" },
    rp: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    dh: { padding: "10px 16px", borderBottom: "1px solid " + C.border, background: C.bgAlt },
    dt: { fontWeight: 600, fontSize: "14px", color: C.textDark },
    dm: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px", alignItems: "center" },
    nw: { flex: 1, overflowY: "auto", padding: "16px" },
    ns: { lineHeight: "1.65", fontSize: "13px", color: C.text },
    ew: { flex: 1, display: "flex", flexDirection: "column", padding: "16px", gap: "10px", overflowY: "auto" },
    fl: { fontWeight: 600, fontSize: "12px", color: "#475569", marginBottom: "4px" },
    ti: { width: "100%", padding: "7px 10px", border: "1px solid " + C.border, borderRadius: "6px", fontSize: "13px", outline: "none", background: C.bg, color: C.textDark, boxSizing: "border-box" },
    br: { display: "flex", gap: "8px", justifyContent: "flex-end", paddingTop: "4px" },
    bp: { padding: "6px 16px", borderRadius: "6px", border: "none", background: C.primary, color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
    bs: { padding: "6px 16px", borderRadius: "6px", border: "1px solid " + C.border, background: C.bg, color: "#475569", fontSize: "12px", fontWeight: 500, cursor: "pointer" },
    empty: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, fontSize: "12px", fontStyle: "italic", padding: "20px", textAlign: "center" },
    fieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
    iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "6px", border: "1px solid " + C.border, background: C.bg, cursor: "pointer" },
  };

  // ─── Helpers ───
  var showForm = isEditing || isAdding;
  var canEdit = hasEditPermission && selectedFop && !showForm;
  var canAdd = hasEditPermission && !showForm;
  var canDelete = hasEditPermission && selectedFop && !showForm;

  // "Updated <date> by <user>" string shown in the header when a record
  // is selected and has been edited at least once.
  var headerUpdatedText = useMemo(function() {
    if (!selectedFop || showForm) return '';
    if (!selectedFop.last_updated) return '';
    var d;
    try { d = new Date(selectedFop.last_updated).toLocaleDateString(); } catch (e) { d = String(selectedFop.last_updated); }
    var s = 'Updated ' + d;
    if (selectedFop.updated_by) s += ' by ' + selectedFop.updated_by;
    return s;
  }, [selectedFop, showForm]);

  function badge(bg, fg, text, key) {
    return <span key={key || text} style={{ display: "inline-flex", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, background: bg, color: fg, whiteSpace: "nowrap" }}>{text}</span>;
  }

  // ─── LEFT PANEL ───
  var leftPanel = (
    <div style={S.lp}>
      <div style={S.sb}>
        <input style={S.si} type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <div style={S.lc}>
        {filtered.length === 0 ? (
          <div style={S.empty}>{fopRecords.length === 0 ? "No records found." : "No results match your search."}</div>
        ) : (
          filtered.map(function(rec) {
            var isSel = selectedFop && selectedFop.id === rec.id;
            return (
              <div
                key={rec.id}
                style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: isSel ? C.primaryLight : "transparent", borderLeft: isSel ? "3px solid " + C.primary : "3px solid transparent" }}
                onClick={() => handleSelect(rec)}
              >
                <span style={{ fontWeight: isSel ? 600 : 400, fontSize: "13px", color: isSel ? C.primary : C.text }}>{rec.payment_summary || "Untitled"}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ─── RIGHT PANEL ───
  var rightContent;

  if (showForm) {
    rightContent = (
      <>
        <div style={S.dh}>
          <span style={S.dt}>{isAdding ? "New Form of Payment" : "Editing: " + editSummary}</span>
        </div>
        <div style={S.ew}>
          <div>
            <div style={S.fl}>Payment Summary</div>
            <input style={S.ti} value={editSummary} onChange={(e) => setEditSummary(e.target.value)} placeholder="e.g. Air, Hotel, Car..." />
          </div>

          <CatSelect selected={editCats} onChange={setEditCats} fieldLabelStyle={S.fl} categories={categoryList} />

          <TravelerTypeSelect
            selected={editTravelerTypes}
            onChange={setEditTravelerTypes}
            options={travelerTypeList}
            fieldLabelStyle={S.fl}
          />

          <SmidSelector smidOptions={smidOptions} selSmids={editSmids} setSelSmids={setEditSmids} />
          <LcnSelector lcnOptions={lcnOptions} selLcns={editLcns} setSelLcns={setEditLcns} />

          <div><div style={{ ...S.fl, marginBottom: "8px" }}>Standard Forms of Payment</div></div>
          <div style={S.fieldRow}>
            {FOP_FIELDS.map(function(f) {
              return (
                <div key={f.key}>
                  <div style={S.fl}>{f.label}</div>
                  <input
                    style={S.ti}
                    value={editFields[f.sk] || ""}
                    onChange={(e) => setEditFields(function(prev) { var n = Object.assign({}, prev); n[f.sk] = e.target.value; return n; })}
                    placeholder={f.label + "..."}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={S.fl}>Notes</div>
            <RichTextEditor value={editNotes} onChange={setEditNotes} />
          </div>

          <div style={S.br}>
            <button style={S.bs} onClick={handleCancel}>Cancel</button>
            <button style={S.bp} onClick={handleSave}>{isAdding ? "Add" : "Save Changes"}</button>
          </div>
        </div>
      </>
    );
  } else if (selectedFop) {
    var cats = parsePgArray(selectedFop.category);
    // Fallback for legacy plain-string category values
    if (cats.length === 0 && selectedFop.category && typeof selectedFop.category === 'string') {
      var single = selectedFop.category.trim();
      if (single) cats = [single];
    }
    var metaBadges = cats.map(function(c, i) { var cc = getCatColor(c); return badge(cc.bg, cc.fg, c, "cat" + i); });

    var ttList = parsePgArray(selectedFop.traveler_type);
    ttList.forEach(function(tt, i) {
      metaBadges.unshift(badge('#fef3c7', '#92400e', tt, 'tt' + i));
    });

    var fopValues = FOP_FIELDS.filter(function(f) { return selectedFop[f.key] && selectedFop[f.key].trim(); }).map(function(f) {
      return (
        <div key={f.key} style={{ display: "flex", gap: "8px", fontSize: "12px", padding: "3px 0" }}>
          <span style={{ fontWeight: 600, color: "#475569", minWidth: "100px" }}>{f.label}:</span>
          <span style={{ color: C.textDark }}>{selectedFop[f.key]}</span>
        </div>
      );
    });

    rightContent = (
      <>
        <div style={S.dh}>
          <div style={S.dt}>{selectedFop.payment_summary || "Untitled"}</div>
          {metaBadges.length > 0 && <div style={S.dm}>{metaBadges}</div>}
        </div>
        {fopValues.length > 0 && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, background: C.bgAlt }}>{fopValues}</div>
        )}
        <div style={S.nw}>
          <NotesDisplay html={selectedFop.notes} style={S.ns} />
        </div>
      </>
    );
  } else {
    rightContent = <div style={S.empty}>Select a record from the list to view details.</div>;
  }

  // ─── RENDER ───
  return (
    <div style={S.root}>
      <div style={S.hdr}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.textDark }}>Forms of Payment</span>
          {filterCategory ? (function() { var cc = getCatColor(filterCategory); return badge(cc.bg, cc.fg, filterCategory, 'fc'); })() : null}
          {filterTravelerType ? badge('#fef3c7', '#92400e', filterTravelerType, 'ft') : null}
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "10px" }}>
            {filtered.length} {filtered.length === 1 ? "record" : "records"}
            {filtered.length !== fopRecords.length ? ' of ' + fopRecords.length : ''}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {headerUpdatedText ? (
            <span style={{ fontSize: "11px", color: C.textMuted, whiteSpace: "nowrap" }}>{headerUpdatedText}</span>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {hasEditPermission && <button
              style={{ ...S.iconBtn, color: canEdit ? "#64748b" : "#cbd5e1", opacity: canEdit ? 1 : 0.5 }}
              title="Edit"
              onClick={canEdit ? handleEdit : undefined}
            >{Icon('edit')}</button>}
            {hasEditPermission && <button
              style={{ ...S.iconBtn, color: canAdd ? "#64748b" : "#cbd5e1", opacity: canAdd ? 1 : 0.5 }}
              title="Add"
              onClick={canAdd ? handleAdd : undefined}
            >{Icon('plus')}</button>}
            {hasEditPermission && <button
              style={{ ...S.iconBtn, color: canDelete ? C.danger : "#cbd5e1", opacity: canDelete ? 1 : 0.5, borderColor: canDelete ? '#fecaca' : C.border }}
              title="Delete"
              onClick={canDelete ? handleDelete : undefined}
            >{Icon('trash')}</button>}
          </div>
        </div>
      </div>
      <div style={S.body}>
        {leftPanel}
        <div style={S.rp}>{rightContent}</div>
      </div>
    </div>
  );
}

// =============================================================================
// CONNECT & RENDER
// =============================================================================

var Wrapped = function(props) {
  return <ErrorBoundary><FopManager {...props} /></ErrorBoundary>;
};
var Connected = Tooljet.connectComponent(Wrapped);
ReactDOM.render(<Connected />, document.body);
