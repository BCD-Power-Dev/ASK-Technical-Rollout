/**
 * Travel Bookers Manager - ToolJet Custom Component
 * Architecture matched to General Topics Manager
 *
 * Data binding (triple curly braces):
 * {{{
 *   bookers: queries.postgresql_get_filtered_travel_bookers.data,
 *   smidOptions: queries.postgresql_get_filtered_SMID_menu.data,
 *   lcnOptions: queries.postgresql_get_filtered_lcn_menu.data,
 *   employeeList: queries.postgresql_get_account_employees.data,
 *   selectedSmid: variables.var_selected_SMID,
 *   selectedLcn: variables.var_selected_lcn,
 *   selectedGcn: variables.var_selected_gcn,
 *   userGroups: globals.currentUser.groups,
 *   currentUser: globals.currentUser.firstName,
 *   listenerQuery: 'travel_bookers_manager',
 *   _refresh: page.variables.var_policy_refresh_key || 0
 * }}}
 */

import React, { useState, useMemo, useRef } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';

// =============================================================================
// UTILITIES
// =============================================================================

function extractQueryData(q) {
  if (!q) return [];
  if (Array.isArray(q)) return q;
  if (q.rawData && Array.isArray(q.rawData) && q.data && Array.isArray(q.data)) {
    if (Object.keys(q.rawData[0] || {}).length > Object.keys(q.data[0] || {}).length) return q.rawData;
  }
  if (q.data && Array.isArray(q.data)) return q.data;
  if (q.rawData && Array.isArray(q.rawData)) return q.rawData;
  return [];
}

function parsePgArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(function(v) { return String(v).trim(); }).filter(Boolean);
  var str = String(val).trim();
  if (str.charAt(0) === '{') str = str.slice(1);
  if (str.charAt(str.length - 1) === '}') str = str.slice(0, -1);
  if (!str) return [];
  var result = [];
  var current = '';
  var inQuote = false;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charAt(i);
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.filter(Boolean);
}

function norm(v) { return String(v || '').trim().toLowerCase().replace(/"/g, ''); }

function nullIfEmpty(v) { return (v && String(v).trim() !== '') ? v : null; }

function escapeSql(v) {
  if (!v) return null;
  return String(v).replace(/'/g, "''");
}

// =============================================================================
// ICONS
// =============================================================================

var ICO = {
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  user: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  phone: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>',
  mail: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  shield: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  star: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  briefcase: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>',
};

function Ico(props) {
  return React.createElement('span', {
    style: { display: 'inline-flex', flexShrink: 0, color: props.color || 'currentColor' },
    dangerouslySetInnerHTML: { __html: ICO[props.name] || '' }
  });
}

// =============================================================================
// SHARED SELECTOR STYLES (matched to General Topics / Fare Class Rules)
// =============================================================================

var CS = {
  section: { marginTop: '8px', marginBottom: '8px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e2e8f0' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  headerActions: { display: 'flex', gap: '4px', alignItems: 'center' },
  sep: { margin: '0 4px', color: '#94a3b8', fontSize: '11px' },
  grid: { display: 'flex', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto' },
  tag: { display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: '12px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginRight: '8px', marginBottom: '8px', cursor: 'pointer' },
  countryTag: { marginLeft: '4px', fontSize: '10px', color: '#94a3b8' },
};

function selectorBtn(color) {
  return { fontSize: '11px', color: color, cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontWeight: 500 };
}

function checkboxDot(sel, color) {
  return { width: 14, height: 14, borderRadius: 3, marginRight: 6, border: '2px solid ' + (sel ? color : '#e2e8f0'), backgroundColor: sel ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
}

// =============================================================================
// SMID SELECTOR
// =============================================================================

function SmidSelector(props) {
  var smidOptions = props.smidOptions;
  var selSmids = props.selSmids;
  var setSelSmids = props.setSelSmids;
  if (!smidOptions || smidOptions.length === 0) return null;
  var toggle = function(id) {
    var sid = String(id);
    setSelSmids(function(prev) { return prev.indexOf(sid) >= 0 ? prev.filter(function(x) { return x !== sid; }) : [].concat(prev, [sid]); });
  };
  var isSelected = function(optionSmid) {
    var nOpt = norm(optionSmid);
    return selSmids.some(function(sel) { return norm(sel) === nOpt; });
  };
  var selectedCount = smidOptions.filter(function(s) { return isSelected(s.smid); }).length;
  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>SMID ({selectedCount}/{smidOptions.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={selectorBtn('#3b82f6')} onClick={function() { setSelSmids(smidOptions.map(function(s) { return String(s.smid); })); }}>Select All</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={selectorBtn('#3b82f6')} onClick={function() { setSelSmids([]); }}>Clear</button>
        </div>
      </div>
      <div style={CS.grid}>
        {smidOptions.map(function(s) {
          var sid = String(s.smid);
          var isSel = isSelected(s.smid);
          return (
            <div key={sid} style={Object.assign({}, CS.tag, isSel ? { backgroundColor: '#eff6ff', borderColor: '#3b82f6' } : {})} onClick={function() { toggle(s.smid); }}>
              <span style={checkboxDot(isSel, '#3b82f6')}>{isSel ? <span style={{ color: '#fff', fontSize: '10px' }}>✓</span> : null}</span>
              {s.title || sid}
              {s.country_a2 ? <span style={CS.countryTag}>({s.country_a2})</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// LCN SELECTOR
// =============================================================================

function LcnSelector(props) {
  var lcnOptions = props.lcnOptions;
  var selLcns = props.selLcns;
  var setSelLcns = props.setSelLcns;
  if (!lcnOptions || lcnOptions.length === 0) return null;
  var getKey = function(l) { return String(l.lcn_number || l.lcn || l.lcn_name || ''); };
  var getLabel = function(l) { return l.lcn_name || l.lcn_number || l.lcn || ''; };
  var toggle = function(id) {
    var lid = String(id);
    setSelLcns(function(prev) { return prev.indexOf(lid) >= 0 ? prev.filter(function(x) { return x !== lid; }) : [].concat(prev, [lid]); });
  };
  var isSelected = function(optKey) {
    var nOpt = norm(optKey);
    return selLcns.some(function(sel) { return norm(sel) === nOpt; });
  };
  var selectedCount = lcnOptions.filter(function(l) { return isSelected(getKey(l)); }).length;
  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6' }}>LCN ({selectedCount}/{lcnOptions.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={selectorBtn('#8b5cf6')} onClick={function() { setSelLcns(lcnOptions.map(function(l) { return getKey(l); })); }}>Select All</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={selectorBtn('#8b5cf6')} onClick={function() { setSelLcns([]); }}>Clear</button>
        </div>
      </div>
      <div style={CS.grid}>
        {lcnOptions.map(function(l, i) {
          var lid = getKey(l);
          var isSel = isSelected(lid);
          return (
            <div key={lid || i} style={Object.assign({}, CS.tag, isSel ? { backgroundColor: '#f5f3ff', borderColor: '#8b5cf6' } : {})} onClick={function() { toggle(lid); }}>
              <span style={checkboxDot(isSel, '#8b5cf6')}>{isSel ? <span style={{ color: '#fff', fontSize: '10px' }}>✓</span> : null}</span>
              {getLabel(l)}
              {l.smid_country_a2 ? <span style={CS.countryTag}>({l.smid_country_a2})</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// ACCOUNT EMPLOYEE SELECTOR (multi-select with search)
// =============================================================================

function EmployeeSelector(props) {
  var employeeList = props.employeeList;
  var selEmployees = props.selEmployees;
  var setSelEmployees = props.setSelEmployees;
  var selectedGcn = props.selectedGcn;
  var empSearch = props.empSearch;
  var setEmpSearch = props.setEmpSearch;

  // Filter employee list by selected GCN + search term
  var filtered = useMemo(function() {
    var list = employeeList || [];
    if (selectedGcn) {
      var nGcn = norm(selectedGcn);
      list = list.filter(function(emp) {
        if (!emp.gcn) return true;
        var empGcns = parsePgArray(emp.gcn);
        return empGcns.length === 0 || empGcns.some(function(eg) { return norm(eg) === nGcn; });
      });
    }
    if (empSearch) {
      var q = empSearch.toLowerCase();
      list = list.filter(function(emp) {
        return (emp.name || '').toLowerCase().indexOf(q) >= 0 ||
               (emp.title || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    return list;
  }, [employeeList, selectedGcn, empSearch]);

  if (!employeeList || employeeList.length === 0) return null;

  var toggle = function(empId) {
    var eid = String(empId);
    setSelEmployees(function(prev) {
      return prev.indexOf(eid) >= 0 ? prev.filter(function(x) { return x !== eid; }) : [].concat(prev, [eid]);
    });
  };
  var isSelected = function(empId) {
    return selEmployees.some(function(sel) { return norm(sel) === norm(empId); });
  };
  var selectedCount = (employeeList || []).filter(function(e) { return isSelected(e.account_employee_idx || e.id); }).length;
  var accentColor = '#0EA5E9';

  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: accentColor }}>Account Employees ({selectedCount})</span>
        <div style={CS.headerActions}>
          <button type="button" style={selectorBtn(accentColor)} onClick={function() { setSelEmployees(filtered.map(function(e) { return String(e.account_employee_idx || e.id); })); }}>Select Visible</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={selectorBtn(accentColor)} onClick={function() { setSelEmployees([]); }}>Clear</button>
        </div>
      </div>
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <input
          value={empSearch}
          onChange={function(e) { setEmpSearch(e.target.value); }}
          placeholder="Search employees…"
          style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px', width: '100%', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>
      <div style={Object.assign({}, CS.grid, { maxHeight: '220px' })}>
        {filtered.map(function(emp) {
          var eid = String(emp.account_employee_idx || emp.id);
          var isSel = isSelected(eid);
          return (
            <div key={eid} style={Object.assign({}, CS.tag, { flexDirection: 'column', alignItems: 'flex-start', padding: '8px 10px', minWidth: '180px' }, isSel ? { backgroundColor: '#F0F9FF', borderColor: accentColor } : {})} onClick={function() { toggle(eid); }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span style={checkboxDot(isSel, accentColor)}>{isSel ? <span style={{ color: '#fff', fontSize: '10px' }}>✓</span> : null}</span>
                <span style={{ fontWeight: 500, fontSize: '12px' }}>{emp.name || '(unnamed)'}</span>
              </div>
              {emp.title ? <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', marginLeft: '20px' }}>{emp.title}</div> : null}
              {emp.l_0 ? <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px', marginLeft: '20px' }}>{emp.l_0}</div> : null}
              {emp.l_1 ? <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px', marginLeft: '20px' }}>{emp.l_1}</div> : null}
            </div>
          );
        })}
        {filtered.length === 0 ? <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '8px' }}>No employees match filters</div> : null}
      </div>
    </div>
  );
}

// =============================================================================
// MARKDOWN TOOLBAR (from General Topics)
// =============================================================================

function MarkdownToolbar(props) {
  var textareaRef = props.textareaRef;
  var value = props.value;
  var onChange = props.onChange;

  function wrapSelection(before, after) {
    var ta = textareaRef.current;
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var text = value;
    var selected = text.substring(start, end);
    var replacement = before + (selected || 'text') + (after || before);
    var newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);
    setTimeout(function() {
      ta.focus();
      var newStart = start + before.length;
      var newEnd = newStart + (selected || 'text').length;
      ta.setSelectionRange(newStart, newEnd);
    }, 0);
  }

  function prefixLines(prefix) {
    var ta = textareaRef.current;
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var text = value;
    var lineStart = text.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;
    var lines = text.substring(lineStart, lineEnd).split('\n');
    var prefixed = lines.map(function(line, i) {
      if (prefix === '1. ') return (i + 1) + '. ' + line;
      return prefix + line;
    }).join('\n');
    var newText = text.substring(0, lineStart) + prefixed + text.substring(lineEnd);
    onChange(newText);
    setTimeout(function() { ta.focus(); }, 0);
  }

  function insertLink() {
    var ta = textareaRef.current;
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var text = value;
    var selected = text.substring(start, end);
    var linkText = selected || 'link text';
    var replacement = '[' + linkText + '](url)';
    var newText = text.substring(0, start) + replacement + text.substring(end);
    onChange(newText);
    setTimeout(function() {
      ta.focus();
      var urlStart = start + linkText.length + 3;
      ta.setSelectionRange(urlStart, urlStart + 3);
    }, 0);
  }

  var btnStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 26, border: '1px solid #E5E7EB', borderRadius: 4,
    background: '#fff', cursor: 'pointer', color: '#6B7280', padding: 0,
  };
  var sepStyle = { width: 1, height: 18, background: '#E5E7EB', margin: '0 4px', flexShrink: 0 };
  var TBICO = {
    bold: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>',
    italic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
    heading: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/></svg>',
    list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    listOl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="4" y="7.5" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="4" y="13.5" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="4" y="19.5" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
    quote: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 8H6a2 2 0 00-2 2v2a2 2 0 002 2h2v2a2 2 0 01-2 2H5v2h1a4 4 0 004-4V8zm10 0h-4a2 2 0 00-2 2v2a2 2 0 002 2h2v2a2 2 0 01-2 2h-1v2h1a4 4 0 004-4V8z"/></svg>',
  };
  function TbIco(n) { return React.createElement('span', { style: { display: 'inline-flex', color: 'currentColor' }, dangerouslySetInnerHTML: { __html: TBICO[n] || '' } }); }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 6px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', borderRadius: '5px 5px 0 0', flexWrap: 'wrap' }}>
      <button type="button" style={btnStyle} title="Bold" onClick={function() { wrapSelection('**'); }}>{TbIco('bold')}</button>
      <button type="button" style={btnStyle} title="Italic" onClick={function() { wrapSelection('*'); }}>{TbIco('italic')}</button>
      <div style={sepStyle} />
      <button type="button" style={btnStyle} title="Heading" onClick={function() { prefixLines('### '); }}>{TbIco('heading')}</button>
      <button type="button" style={btnStyle} title="Bullet List" onClick={function() { prefixLines('- '); }}>{TbIco('list')}</button>
      <button type="button" style={btnStyle} title="Numbered List" onClick={function() { prefixLines('1. '); }}>{TbIco('listOl')}</button>
      <div style={sepStyle} />
      <button type="button" style={btnStyle} title="Link" onClick={insertLink}>{TbIco('link')}</button>
      <button type="button" style={btnStyle} title="Quote" onClick={function() { prefixLines('> '); }}>{TbIco('quote')}</button>
    </div>
  );
}

// =============================================================================
// MARKDOWN RENDERER (for detail display)
// =============================================================================

function RenderMarkdown(props) {
  var text = props.text || '';
  if (!text) return React.createElement('span', { style: { color: '#9CA3AF', fontStyle: 'italic' } }, 'No notes provided.');

  var lines = text.split('\n');
  var elements = [];
  var i = 0;

  while (i < lines.length) {
    var line = lines[i];
    if (line.match(/^### /)) { elements.push(React.createElement('h4', { key: i, style: { fontSize: '14px', fontWeight: 700, color: '#111827', margin: '12px 0 4px' } }, renderInline(line.slice(4)))); i++; continue; }
    if (line.match(/^## /)) { elements.push(React.createElement('h3', { key: i, style: { fontSize: '15px', fontWeight: 700, color: '#111827', margin: '12px 0 4px' } }, renderInline(line.slice(3)))); i++; continue; }
    if (line.match(/^# /)) { elements.push(React.createElement('h2', { key: i, style: { fontSize: '16px', fontWeight: 700, color: '#111827', margin: '12px 0 4px' } }, renderInline(line.slice(2)))); i++; continue; }
    if (line.match(/^> /)) { elements.push(React.createElement('div', { key: i, style: { borderLeft: '3px solid #3B82F6', paddingLeft: '12px', margin: '6px 0', color: '#4B5563', fontStyle: 'italic' } }, renderInline(line.slice(2)))); i++; continue; }
    if (line.match(/^- /)) {
      var listItems = [];
      while (i < lines.length && lines[i].match(/^- /)) { listItems.push(React.createElement('li', { key: i, style: { marginBottom: '2px' } }, renderInline(lines[i].slice(2)))); i++; }
      elements.push(React.createElement('ul', { key: 'ul' + i, style: { margin: '6px 0', paddingLeft: '20px' } }, listItems)); continue;
    }
    if (line.match(/^\d+\. /)) {
      var olItems = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { olItems.push(React.createElement('li', { key: i, style: { marginBottom: '2px' } }, renderInline(lines[i].replace(/^\d+\.\s/, '')))); i++; }
      elements.push(React.createElement('ol', { key: 'ol' + i, style: { margin: '6px 0', paddingLeft: '20px' } }, olItems)); continue;
    }
    if (line.trim() === '') { elements.push(React.createElement('div', { key: i, style: { height: '8px' } })); i++; continue; }
    elements.push(React.createElement('p', { key: i, style: { margin: '4px 0', lineHeight: '1.7' } }, renderInline(line))); i++;
  }
  return React.createElement('div', null, elements);
}

function renderInline(text) {
  if (!text) return null;
  var parts = [];
  var regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  var lastIndex = 0;
  var match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(renderBoldItalic(text.substring(lastIndex, match.index), lastIndex));
    parts.push(React.createElement('a', { key: 'link' + match.index, href: match[2], target: '_blank', rel: 'noopener noreferrer', style: { color: '#3B82F6', textDecoration: 'underline' } }, match[1]));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(renderBoldItalic(text.substring(lastIndex), lastIndex));
  return parts.length === 1 ? parts[0] : parts;
}

function renderBoldItalic(text, keyBase) {
  if (!text) return null;
  var parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) {
    var italicParts = text.split(/\*(.*?)\*/g);
    if (italicParts.length === 1) return text;
    return italicParts.map(function(p, i) { return i % 2 === 1 ? React.createElement('em', { key: (keyBase || 0) + 'i' + i }, p) : p; });
  }
  return parts.map(function(p, i) { return i % 2 === 1 ? React.createElement('strong', { key: (keyBase || 0) + 'b' + i }, p) : p; });
}

// =============================================================================
// STYLES
// =============================================================================

var border = '#E5E7EB';
var bgAlt = '#F9FAFB';
var blue = '#3B82F6';
var muted = '#9CA3AF';
var green = '#059669';

var labelSt = { fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' };
var inputSt = { padding: '7px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '5px', color: '#1F2937', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%' };
var selectSt = { padding: '7px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '5px', color: '#1F2937', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%', cursor: 'pointer' };

// =============================================================================
// BLANK FORM
// =============================================================================

var BLANK = {
  trav_booker_name: '',
  trav_booker_email: '',
  trav_booker_phone: '',
  alternates: '',
  validation: '',
  notes: '',
  general: false,
  vip: false,
  elite24: false,
};

var EMP_BLANK = {
  name: '',
  title: '',
  gcn: '',
  smid: '',
  lcn: '',
  l_0: '',
  l_1: '',
  l_2: '',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function TravelBookers(props) {
  var data = props.data || {};
  var updateData = props.updateData;
  var runQuery = props.runQuery;

  // ── State ──
  var [selectedId, setSelectedId] = useState(null);
  var [searchTerm, setSearchTerm] = useState('');
  var [filterType, setFilterType] = useState('ALL');
  var [editId, setEditId] = useState(null);
  var [adding, setAdding] = useState(false);
  var [delId, setDelId] = useState(null);
  var [form, setForm] = useState(Object.assign({}, BLANK));
  var [editSmids, setEditSmids] = useState([]);
  var [editLcns, setEditLcns] = useState([]);
  var [editEmployees, setEditEmployees] = useState([]);
  var [saving, setSaving] = useState(false);
  var [empSearch, setEmpSearch] = useState('');
  var notesRef = useRef(null);
  var empPrefsRef = useRef(null);

  // ── Employee CRUD State ──
  var [empEditId, setEmpEditId] = useState(null);
  var [empAdding, setEmpAdding] = useState(false);
  var [empDelId, setEmpDelId] = useState(null);
  var [empForm, setEmpForm] = useState(Object.assign({}, EMP_BLANK));
  var [empSaving, setEmpSaving] = useState(false);

  // ── Data from ToolJet ──
  var rawBookers = useMemo(function() { return extractQueryData(data.bookers); }, [data.bookers, data._refresh]);
  var smidOptions = useMemo(function() { return Array.isArray(data.smidOptions) ? data.smidOptions : []; }, [data.smidOptions, data._refresh]);
  var lcnOptions = useMemo(function() { return Array.isArray(data.lcnOptions) ? data.lcnOptions : []; }, [data.lcnOptions, data._refresh]);
  var employeeList = useMemo(function() { return Array.isArray(data.employeeList) ? data.employeeList : []; }, [data.employeeList, data._refresh]);
  // ── Permission check ──
  var EDITOR_GROUPS = ['admin', 'builder', 'Content_Editor'];
  var userGroups = useMemo(function() {
    var groups = data.userGroups;
    if (Array.isArray(groups)) return groups;
    if (typeof groups === 'string') return [groups];
    return [];
  }, [data.userGroups]);
  var canEdit = useMemo(function() {
    return userGroups.some(function(g) {
      return EDITOR_GROUPS.indexOf(g) >= 0;
    });
  }, [userGroups]);
  var listenerQuery = data.listenerQuery || 'travel_bookers_manager';
  var selectedGcn = data.selectedGcn || '';

  // ── Helper: resolve employee details from IDs ──
  function resolveEmployeeDetails(empIdStr) {
    var ids = parsePgArray(empIdStr);
    if (ids.length === 0) return [];
    return ids.map(function(eid) {
      var emp = employeeList.find(function(e) { return norm(e.account_employee_idx) === norm(eid) || norm(e.id) === norm(eid); });
      if (emp) {
        return { id: eid, account_employee_idx: emp.account_employee_idx || eid, name: emp.name || '(unnamed)', title: emp.title || '', gcn: emp.gcn || '', smid: emp.smid || '', lcn: emp.lcn || '', l_0: emp.l_0 || '', l_1: emp.l_1 || '', l_2: emp.l_2 || '' };
      }
      return { id: eid, account_employee_idx: eid, name: eid, title: '', gcn: '', smid: '', lcn: '', l_0: '', l_1: '', l_2: '' };
    });
  }

  // ── Filtered + sorted bookers ──
  var bookers = useMemo(function() {
    var list = rawBookers.slice();
    if (searchTerm) {
      var q = searchTerm.toLowerCase();
      list = list.filter(function(b) {
        // Direct field matching
        if ((b.trav_booker_name || '').toLowerCase().indexOf(q) >= 0) return true;
        if ((b.trav_booker_email || '').toLowerCase().indexOf(q) >= 0) return true;
        if ((b.trav_booker_phone || '').toLowerCase().indexOf(q) >= 0) return true;
        if ((b.account_employee || '').toLowerCase().indexOf(q) >= 0) return true;
        // Resolve employee IDs to names for bi-directional search
        var empIds = parsePgArray(b.account_employee_id);
        if (empIds.length > 0) {
          return empIds.some(function(eid) {
            var emp = employeeList.find(function(e) { return norm(e.account_employee_idx) === norm(eid) || norm(e.id) === norm(eid); });
            if (!emp) return false;
            return (emp.name || '').toLowerCase().indexOf(q) >= 0 ||
                   (emp.title || '').toLowerCase().indexOf(q) >= 0;
          });
        }
        return false;
      });
    }
    if (filterType !== 'ALL') {
      if (filterType === 'general') list = list.filter(function(b) { return b.general === true; });
      else if (filterType === 'vip') list = list.filter(function(b) { return b.vip === true; });
      else if (filterType === 'elite24') list = list.filter(function(b) { return b.elite24 === true; });
    }
    list.sort(function(a, b) { return (a.trav_booker_name || '').localeCompare(b.trav_booker_name || ''); });
    return list;
  }, [rawBookers, searchTerm, filterType, employeeList]);

  var selectedBooker = useMemo(function() {
    return bookers.find(function(b) { return b.id === selectedId; }) || null;
  }, [bookers, selectedId]);

  // Auto-select first
  React.useEffect(function() {
    if (!selectedBooker && bookers.length > 0) setSelectedId(bookers[0].id);
  }, [bookers, selectedBooker]);

  // Reset on refresh
  React.useEffect(function() {
    setSelectedId(null);
  }, [data._refresh]);

  // ── Type counts ──
  var typeCounts = useMemo(function() {
    var counts = { ALL: rawBookers.length, general: 0, vip: 0, elite24: 0 };
    rawBookers.forEach(function(b) {
      if (b.general) counts.general++;
      if (b.vip) counts.vip++;
      if (b.elite24) counts.elite24++;
    });
    return counts;
  }, [rawBookers]);

  // ── Handlers ──
  function onField(k, v) { setForm(function(p) { var n = Object.assign({}, p); n[k] = v; return n; }); }

  function startAdd() {
    setAdding(true); setEditId(null); setDelId(null);
    setForm(Object.assign({}, BLANK));
    var preSmids = parsePgArray(data.selectedSmid);
    var preLcns = parsePgArray(data.selectedLcn);
    setEditSmids(preSmids);
    setEditLcns(preLcns);
    setEditEmployees([]);
    setEmpSearch('');
  }

  function startEdit(r) {
    setEditId(r.id); setAdding(false); setDelId(null);
    setForm({
      trav_booker_name: r.trav_booker_name || '',
      trav_booker_email: r.trav_booker_email || '',
      trav_booker_phone: r.trav_booker_phone || '',
      alternates: r.alternates || '',
      validation: r.validation || '',
      notes: r.notes || '',
      general: r.general === true,
      vip: r.vip === true,
      elite24: r.elite24 === true,
    });
    var rSmids = parsePgArray(r.smid);
    var rLcns = parsePgArray(r.lcn);
    var rEmps = parsePgArray(r.account_employee_id);
    setEditSmids(rSmids.length > 0 ? rSmids : parsePgArray(data.selectedSmid));
    setEditLcns(rLcns.length > 0 ? rLcns : parsePgArray(data.selectedLcn));
    setEditEmployees(rEmps);
    setEmpSearch('');
  }

  function doSave() {
    if (saving) return;
    setSaving(true);

    // Build employee name list from selected IDs
    var empNames = editEmployees.map(function(eid) {
      var emp = employeeList.find(function(e) { return norm(e.account_employee_idx) === norm(eid) || norm(e.id) === norm(eid); });
      return emp ? emp.name : '';
    }).filter(Boolean);

    var payload = {
      trav_booker_name: escapeSql(form.trav_booker_name),
      trav_booker_email: escapeSql(nullIfEmpty(form.trav_booker_email)),
      trav_booker_phone: escapeSql(nullIfEmpty(form.trav_booker_phone)),
      alternates: escapeSql(nullIfEmpty(form.alternates)),
      validation: escapeSql(nullIfEmpty(form.validation)),
      notes: escapeSql(nullIfEmpty(form.notes)),
      general: form.general || false,
      vip: form.vip || false,
      elite24: form.elite24 || false,
      gcn: selectedGcn || null,
      smid: editSmids.length > 0 ? '{' + editSmids.join(',') + '}' : null,
      lcn: editLcns.length > 0 ? '{' + editLcns.join(',') + '}' : null,
      account_employee_id: editEmployees.length > 0 ? '{' + editEmployees.join(',') + '}' : null,
      account_employee: empNames.length > 0 ? '{' + empNames.join(',') + '}' : null,
    };

    var isNew = !editId;
    var actionData = {
      action: isNew ? 'add' : 'edit',
      selectedBookerId: editId,
      formData: payload,
    };

    // Debug: uncomment to trace payload
    // console.log('[TB] doSave:', actionData.action, JSON.stringify(payload));

    updateData(actionData);

    setEditId(null); setAdding(false); setForm(Object.assign({}, BLANK));
    setEditSmids([]); setEditLcns([]); setEditEmployees([]);

    setTimeout(function() {
      if (runQuery) {
        try { runQuery(listenerQuery); }
        catch (err) { console.error('[TB] runQuery error:', err); }
      }
      setSaving(false);
    }, 500);
  }

  function doDelete(id, e) {
    e.stopPropagation();
    var actionData = { action: 'delete', selectedBookerId: id, formData: {} };
    updateData(actionData);
    setDelId(null);
    setTimeout(function() {
      if (runQuery) {
        try { runQuery(listenerQuery); } catch (err) { console.error('[TB] runQuery error:', err); }
      }
    }, 500);
  }

  function doCancel() {
    setEditId(null); setAdding(false); setDelId(null);
    setForm(Object.assign({}, BLANK));
    setEditSmids([]); setEditLcns([]); setEditEmployees([]);
  }

  // ── Employee CRUD Handlers ──
  function onEmpField(k, v) { setEmpForm(function(p) { var n = Object.assign({}, p); n[k] = v; return n; }); }

  function startAddEmployee() {
    setEmpAdding(true); setEmpEditId(null); setEmpDelId(null);
    var f = Object.assign({}, EMP_BLANK);
    // Pre-fill from page context
    if (data.selectedGcn) f.gcn = String(data.selectedGcn);
    if (data.selectedSmid) f.smid = String(data.selectedSmid);
    if (data.selectedLcn) f.lcn = String(data.selectedLcn);
    setEmpForm(f);
  }

  function startEditEmployee(emp) {
    setEmpEditId(emp.account_employee_idx || emp.id);
    setEmpAdding(false); setEmpDelId(null);
    setEmpForm({
      name: emp.name || '',
      title: emp.title || '',
      gcn: emp.gcn || '',
      smid: emp.smid || '',
      lcn: emp.lcn || '',
      l_0: emp.l_0 || '',
      l_1: emp.l_1 || '',
      l_2: emp.l_2 || '',
    });
  }

  function doSaveEmployee() {
    if (empSaving) return;
    setEmpSaving(true);

    var payload = {
      name: escapeSql(empForm.name),
      title: escapeSql(nullIfEmpty(empForm.title)),
      gcn: escapeSql(nullIfEmpty(empForm.gcn)),
      smid: escapeSql(nullIfEmpty(empForm.smid)),
      lcn: escapeSql(nullIfEmpty(empForm.lcn)),
      l_0: escapeSql(nullIfEmpty(empForm.l_0)),
      l_1: escapeSql(nullIfEmpty(empForm.l_1)),
      l_2: escapeSql(nullIfEmpty(empForm.l_2)),
    };

    var isNew = !empEditId;
    var actionData = {
      action: isNew ? 'add_employee' : 'edit_employee',
      selectedEmployeeId: empEditId,
      empFormData: payload,
    };

    // Debug: uncomment to trace payload
    // console.log('[TB] doSaveEmployee:', actionData.action, JSON.stringify(payload));
    updateData(actionData);

    setEmpEditId(null); setEmpAdding(false); setEmpForm(Object.assign({}, EMP_BLANK));

    setTimeout(function() {
      if (runQuery) {
        try { runQuery(listenerQuery); } catch (err) { console.error('[TB] emp runQuery error:', err); }
      }
      setEmpSaving(false);
    }, 500);
  }

  function doDeleteEmployee(empId, e) {
    if (e) e.stopPropagation();
    var actionData = { action: 'delete_employee', selectedEmployeeId: empId, empFormData: {} };
    updateData(actionData);
    setEmpDelId(null);
    setTimeout(function() {
      if (runQuery) {
        try { runQuery(listenerQuery); } catch (err) { console.error('[TB] emp runQuery error:', err); }
      }
    }, 500);
  }

  function doCancelEmployee() {
    setEmpEditId(null); setEmpAdding(false); setEmpDelId(null);
    setEmpForm(Object.assign({}, EMP_BLANK));
  }

  // ── Render Employee Form (inline) ──
  function mkEmployeeForm(isNew) {
    var accentColor = '#0EA5E9';
    return (
      <div style={{ margin: '8px 0', border: '1px solid ' + accentColor, borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', background: '#F0F9FF', borderBottom: '1px solid #BAE6FD', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0369A1' }}>{isNew ? '+ New Employee' : 'Edit Employee'}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, display: 'inline-flex' }} onClick={doCancelEmployee}><Ico name="x" /></button>
        </div>
        <div style={{ padding: '12px' }}>
          {/* Name + Title */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={labelSt}>Name *</label>
              <input style={inputSt} value={empForm.name} placeholder="Employee name" onChange={function(e) { onEmpField('name', e.target.value); }} />
            </div>
            <div>
              <label style={labelSt}>Title</label>
              <input style={inputSt} value={empForm.title} placeholder="Job title" onChange={function(e) { onEmpField('title', e.target.value); }} />
            </div>
          </div>
          {/* GCN + SMID + LCN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={labelSt}>GCN</label>
              <input style={Object.assign({}, inputSt, { background: '#F9FAFB', color: '#6B7280' })} value={empForm.gcn} readOnly title="GCN is inherited from the selected account" />
            </div>
            <div>
              <label style={labelSt}>SMID</label>
              <input style={Object.assign({}, inputSt, { background: '#F9FAFB', color: '#6B7280' })} value={empForm.smid} readOnly title="SMID is inherited from the selected account" />
            </div>
            <div>
              <label style={labelSt}>LCN</label>
              <input style={Object.assign({}, inputSt, { background: '#F9FAFB', color: '#6B7280' })} value={empForm.lcn} readOnly title="LCN is inherited from the selected account" />
            </div>
          </div>
          {/* Email / Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={labelSt}>Email</label>
              <input style={inputSt} type="email" value={empForm.l_0} placeholder="employee@example.com" onChange={function(e) { onEmpField('l_0', e.target.value); }} />
            </div>
            <div>
              <label style={labelSt}>Phone</label>
              <input style={inputSt} value={empForm.l_1} placeholder="+1 (555) 123-4567" onChange={function(e) { onEmpField('l_1', e.target.value); }} />
            </div>
          </div>
          {/* Preferences & Notes */}
          <div style={{ marginBottom: '4px' }}>
            <label style={labelSt}>Preferences & Notes</label>
            <div style={{ border: '1px solid #D1D5DB', borderRadius: '5px', overflow: 'hidden' }}>
              <MarkdownToolbar textareaRef={empPrefsRef} value={empForm.l_2} onChange={function(v) { onEmpField('l_2', v); }} />
              <textarea
                ref={empPrefsRef}
                style={Object.assign({}, inputSt, { minHeight: '100px', resize: 'vertical', border: 'none', borderRadius: '0 0 5px 5px' })}
                value={empForm.l_2}
                placeholder="Travel preferences, after-hours instructions, Air/Car/Rail/Hotel notes..."
                onChange={function(e) { onEmpField('l_2', e.target.value); }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', padding: '8px 12px', borderTop: '1px solid ' + border, background: bgAlt }}>
          <button style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '5px', cursor: 'pointer' }} onClick={doCancelEmployee}>Cancel</button>
          <button
            style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 500, color: '#fff', background: empSaving ? '#7DD3FC' : accentColor, border: 'none', borderRadius: '5px', cursor: empSaving ? 'not-allowed' : 'pointer' }}
            onClick={doSaveEmployee}
            disabled={empSaving || !empForm.name.trim()}
          >
            {empSaving ? 'Saving...' : (isNew ? 'Add Employee' : 'Save')}
          </button>
        </div>
      </div>
    );
  }

  // ── Toggle checkbox style ──
  function ToggleCheckbox(p) {
    var checked = p.checked;
    var onChange = p.onChange;
    var label = p.label;
    var color = p.color || blue;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 0' }} onClick={function() { onChange(!checked); }}>
        <span style={checkboxDot(checked, color)}>{checked ? <span style={{ color: '#fff', fontSize: '10px' }}>✓</span> : null}</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: checked ? '#1F2937' : '#6B7280' }}>{label}</span>
      </div>
    );
  }

  // ── Render Form (Add/Edit) ──
  function mkForm(isNew) {
    return (
      <div style={{ margin: '0 12px 8px', border: '1px solid ' + blue, borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderBottom: '1px solid #DBEAFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D4ED8' }}>{isNew ? '+ New Travel Booker' : 'Edit Travel Booker'}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, display: 'inline-flex' }} onClick={doCancel}><Ico name="x" /></button>
        </div>
        <div style={{ padding: '14px', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>

          {/* Name */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>Booker Name *</label>
            <input style={inputSt} value={form.trav_booker_name} placeholder="Enter booker name" onChange={function(e) { onField('trav_booker_name', e.target.value); }} />
          </div>

          {/* Email + Phone side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={labelSt}>Email</label>
              <input style={inputSt} type="email" value={form.trav_booker_email} placeholder="email@example.com" onChange={function(e) { onField('trav_booker_email', e.target.value); }} />
            </div>
            <div>
              <label style={labelSt}>Phone</label>
              <input style={inputSt} value={form.trav_booker_phone} placeholder="+1 (555) 123-4567" onChange={function(e) { onField('trav_booker_phone', e.target.value); }} />
            </div>
          </div>

          {/* Alternates */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>Alternates</label>
            <input style={inputSt} value={form.alternates} placeholder="Alternate contacts" onChange={function(e) { onField('alternates', e.target.value); }} />
          </div>

          {/* Service Level Checkboxes */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>Service Levels</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '6px 0' }}>
              <ToggleCheckbox label="General" checked={form.general} color="#059669" onChange={function(v) { onField('general', v); }} />
              <ToggleCheckbox label="VIP" checked={form.vip} color="#D97706" onChange={function(v) { onField('vip', v); }} />
              <ToggleCheckbox label="Elite 24" checked={form.elite24} color="#7C3AED" onChange={function(v) { onField('elite24', v); }} />
            </div>
          </div>

          {/* Validation */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>Validation</label>
            <input style={inputSt} value={form.validation} placeholder="Validation notes" onChange={function(e) { onField('validation', e.target.value); }} />
          </div>

          {/* Notes with Markdown Toolbar */}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelSt}>Notes</label>
            <div style={{ border: '1px solid #D1D5DB', borderRadius: '5px', overflow: 'hidden' }}>
              <MarkdownToolbar textareaRef={notesRef} value={form.notes} onChange={function(v) { onField('notes', v); }} />
              <textarea
                ref={notesRef}
                style={Object.assign({}, inputSt, { minHeight: '100px', resize: 'vertical', border: 'none', borderRadius: '0 0 5px 5px' })}
                value={form.notes}
                placeholder="Enter notes (supports markdown)"
                onChange={function(e) { onField('notes', e.target.value); }}
              />
            </div>
          </div>

          {/* SMID Selector */}
          <SmidSelector smidOptions={smidOptions} selSmids={editSmids} setSelSmids={setEditSmids} />

          {/* LCN Selector */}
          <LcnSelector lcnOptions={lcnOptions} selLcns={editLcns} setSelLcns={setEditLcns} />

          {/* Employee Selector */}
          <EmployeeSelector employeeList={employeeList} selEmployees={editEmployees} setSelEmployees={setEditEmployees} selectedGcn={selectedGcn} empSearch={empSearch} setEmpSearch={setEmpSearch} />

          {/* Add New Employee (inline) */}
          {canEdit && !empAdding && !empEditId ? (
            <div style={{ padding: '0 12px 8px' }}>
              <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: '#0EA5E9', background: 'none', border: '1px dashed #BAE6FD', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center' }} onClick={startAddEmployee}>
                <Ico name="plus" color="#0EA5E9" /> New Employee
              </button>
            </div>
          ) : null}
          {empAdding ? mkEmployeeForm(true) : null}
          {empEditId ? mkEmployeeForm(false) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px 14px', borderTop: '1px solid ' + border, background: bgAlt }}>
          <button style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer' }} onClick={doCancel}>Cancel</button>
          <button
            style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 500, color: '#fff', background: saving ? '#93C5FD' : blue, border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={doSave}
            disabled={saving || !form.trav_booker_name.trim()}
          >
            {saving ? 'Saving...' : (isNew ? 'Add Booker' : 'Save')}
          </button>
        </div>
      </div>
    );
  }

  // ── Render Detail View (right side) ──
  function mkDetailView() {
    if (!selectedBooker) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: muted }}>
          <Ico name="users" color={muted} />
          <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '8px' }}>Select a travel booker</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Choose a booker from the list to view details.</div>
        </div>
      );
    }

    var r = selectedBooker;

    if (editId === r.id) return mkForm(false);

    var employees = resolveEmployeeDetails(r.account_employee_id);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header bar */}
        <div style={{ padding: '12px 16px', background: bgAlt, borderBottom: '1px solid ' + border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: '1.3' }}>{r.trav_booker_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                {r.general ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#ECFDF5', color: green }}><Ico name="check" color={green} /> General</span> : null}
                {r.vip ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#FEF3C7', color: '#D97706' }}><Ico name="star" color="#D97706" /> VIP</span> : null}
                {r.elite24 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED' }}><Ico name="shield" color="#7C3AED" /> Elite 24</span> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
                {r.trav_booker_email ? (
                  <span style={{ fontSize: '11px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Ico name="mail" color={muted} /> {r.trav_booker_email}
                  </span>
                ) : null}
                {r.trav_booker_phone ? (
                  <span style={{ fontSize: '11px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Ico name="phone" color={muted} /> {r.trav_booker_phone}
                  </span>
                ) : null}
              </div>
              {/* GCN / SMID / LCN badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {r.gcn ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#FFFBEB', color: '#B45309' }}>GCN: {r.gcn}</span> : null}
                {r.smid ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#EFF6FF', color: blue }}>SMID: {r.smid}</span> : null}
                {r.lcn ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#ECFDF5', color: green }}>LCN: {r.lcn}</span> : null}
              </div>
            </div>
            {canEdit ? (
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 4, background: 'transparent', color: blue, cursor: 'pointer' }} title="Edit" onClick={function() { startEdit(r); }}><Ico name="edit" color={blue} /></button>
                <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 4, background: 'transparent', color: '#EF4444', cursor: 'pointer' }} title="Delete" onClick={function() { setDelId(r.id); }}><Ico name="trash" color="#EF4444" /></button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Detail body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Contact Details Card */}
          <div style={{ background: '#fff', border: '1px solid ' + border, borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Ico name="phone" color={blue} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Details</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>Email</div>
                <div style={{ fontSize: '13px', color: '#1F2937' }}>{r.trav_booker_email || <span style={{ color: muted, fontStyle: 'italic' }}>—</span>}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>Phone</div>
                <div style={{ fontSize: '13px', color: '#1F2937' }}>{r.trav_booker_phone || <span style={{ color: muted, fontStyle: 'italic' }}>—</span>}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>Alternates</div>
                <div style={{ fontSize: '13px', color: '#1F2937' }}>{r.alternates || <span style={{ color: muted, fontStyle: 'italic' }}>—</span>}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>Validation</div>
                <div style={{ fontSize: '13px', color: '#1F2937' }}>{r.validation || <span style={{ color: muted, fontStyle: 'italic' }}>—</span>}</div>
              </div>
            </div>
          </div>

          {/* Related Employees Card */}
          <div style={{ background: '#fff', border: '1px solid ' + border, borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Ico name="users" color="#0EA5E9" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Related Account Employees ({employees.length})</span>
              </div>
              {canEdit && !empAdding && !empEditId ? (
                <button style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 10px', fontSize: '11px', fontWeight: 500, color: '#0EA5E9', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '5px', cursor: 'pointer' }} onClick={startAddEmployee}>
                  <Ico name="plus" color="#0EA5E9" /> Add
                </button>
              ) : null}
            </div>

            {/* Inline employee form (add/edit) */}
            {empAdding ? mkEmployeeForm(true) : null}
            {empEditId ? mkEmployeeForm(false) : null}

            {employees.length === 0 && !empAdding ? (
              <div style={{ fontSize: '12px', color: muted, fontStyle: 'italic' }}>No employees linked to this booker.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {employees.map(function(emp) {
                  var isDeleting = empDelId === emp.id;
                  return (
                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: isDeleting ? '#FEF2F2' : '#F0F9FF', border: '1px solid ' + (isDeleting ? '#FECACA' : '#BAE6FD'), borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <Ico name="user" color={isDeleting ? '#EF4444' : '#0EA5E9'} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 500, color: isDeleting ? '#991B1B' : '#0C4A6E' }}>{emp.name}</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {emp.title ? <span style={{ fontSize: '10px', color: '#6B7280' }}>{emp.title}</span> : null}
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {emp.l_0 ? <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '3px' }}><Ico name="mail" color="#9CA3AF" /> {emp.l_0}</span> : null}
                            {emp.l_1 ? <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '3px' }}><Ico name="phone" color="#9CA3AF" /> {emp.l_1}</span> : null}
                          </div>
                          {emp.l_2 ? <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '3px', borderTop: '1px solid #E0F2FE', paddingTop: '3px' }}><RenderMarkdown text={emp.l_2} /></div> : null}
                        </div>
                      </div>
                      {canEdit ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                          {isDeleting ? (
                            <React.Fragment>
                              <span style={{ fontSize: '11px', color: '#991B1B', marginRight: '6px' }}>Delete?</span>
                              <button style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '4px', cursor: 'pointer' }} onClick={function() { setEmpDelId(null); }}>No</button>
                              <button style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 500, color: '#fff', background: '#EF4444', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '4px' }} onClick={function(e) { doDeleteEmployee(emp.account_employee_idx || emp.id, e); }}>Yes</button>
                            </React.Fragment>
                          ) : (
                            <React.Fragment>
                              <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: 'none', borderRadius: 4, background: 'transparent', color: '#0EA5E9', cursor: 'pointer' }} title="Edit Employee" onClick={function() { startEditEmployee(emp); }}><Ico name="edit" color="#0EA5E9" /></button>
                              <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: 'none', borderRadius: 4, background: 'transparent', color: '#EF4444', cursor: 'pointer' }} title="Delete Employee" onClick={function() { setEmpDelId(emp.id); }}><Ico name="trash" color="#EF4444" /></button>
                            </React.Fragment>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes Card */}
          <div style={{ background: '#fff', border: '1px solid ' + border, borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Ico name="file" color={blue} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</span>
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#374151' }}>
              <RenderMarkdown text={r.notes} />
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {delId === r.id ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#FEF2F2', borderTop: '1px solid #FECACA' }}>
            <span style={{ fontSize: '12px', color: '#991B1B', fontWeight: 500 }}>Delete "{r.trav_booker_name}"?</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '5px', cursor: 'pointer' }} onClick={function() { setDelId(null); }}>Cancel</button>
              <button style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, color: '#fff', background: '#EF4444', border: 'none', borderRadius: '5px', cursor: 'pointer' }} onClick={function(e) { doDelete(r.id, e); }}>Delete</button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Main Render ──
  var cnt = bookers.length;
  var sub = cnt > 0 ? cnt + ' booker' + (cnt !== 1 ? 's' : '') : 'No bookers found';

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '13px', color: '#1F2937', background: '#fff', overflow: 'hidden' }}>

      {/* ═══════════ LEFT SIDEBAR ═══════════ */}
      <div style={{ width: '300px', minWidth: '280px', display: 'flex', flexDirection: 'column', borderRight: '1px solid ' + border, background: '#fff' }}>

        {/* Sidebar header */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid ' + border, background: bgAlt }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Travel Bookers</div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{sub}</div>
            </div>
            {canEdit && !adding ? (
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', fontSize: '12px', fontWeight: 500, color: '#fff', background: blue, border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={startAdd}>
                <Ico name="plus" /> Add
              </button>
            ) : null}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <span style={{ position: 'absolute', left: '8px', top: '7px', color: muted, display: 'flex' }}><Ico name="search" color={muted} /></span>
            <input
              value={searchTerm}
              onChange={function(e) { setSearchTerm(e.target.value); }}
              placeholder="Search bookers or employees…"
              style={Object.assign({}, inputSt, { paddingLeft: '28px', fontSize: '12px' })}
            />
          </div>

          {/* Service level filter */}
          <select
            value={filterType}
            onChange={function(e) { setFilterType(e.target.value); }}
            style={Object.assign({}, selectSt, { fontSize: '12px' })}
          >
            <option value="ALL">All Service Levels ({typeCounts.ALL || 0})</option>
            <option value="general">General ({typeCounts.general || 0})</option>
            <option value="vip">VIP ({typeCounts.vip || 0})</option>
            <option value="elite24">Elite 24 ({typeCounts.elite24 || 0})</option>
          </select>
        </div>

        {/* Booker list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {bookers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: muted, fontSize: '12px' }}>No bookers match your filters</div>
          ) : null}
          {bookers.map(function(b) {
            var active = b.id === selectedId;
            var empCount = parsePgArray(b.account_employee_id).length;
            return (
              <div
                key={b.id}
                onClick={function() { setSelectedId(b.id); }}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                  background: active ? '#EFF6FF' : '#fff',
                  borderLeft: active ? '3px solid ' + blue : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: active ? 600 : 500, color: active ? '#1D4ED8' : '#1F2937', lineHeight: '1.3', marginBottom: '2px' }}>
                  {b.trav_booker_name || '(unnamed)'}
                </div>
                {b.trav_booker_email ? (
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.trav_booker_email}</div>
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  {b.general ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, background: '#ECFDF5', color: green }}>GEN</span> : null}
                  {b.vip ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, background: '#FEF3C7', color: '#D97706' }}>VIP</span> : null}
                  {b.elite24 ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED' }}>E24</span> : null}
                  {empCount > 0 ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 500, background: '#F0F9FF', color: '#0EA5E9' }}>{empCount} emp</span> : null}
                  {b.smid ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 500, background: '#EFF6FF', color: blue }}>SMID</span> : null}
                  {b.lcn ? <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 500, background: '#ECFDF5', color: green }}>LCN</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════ RIGHT CONTENT ═══════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
        {adding ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {mkForm(true)}
          </div>
        ) : mkDetailView()}
      </div>
    </div>
  );
}

// =============================================================================
// CONNECT & RENDER
// =============================================================================

var Connected = Tooljet.connectComponent(TravelBookers);
ReactDOM.render(<Connected />, document.body);
