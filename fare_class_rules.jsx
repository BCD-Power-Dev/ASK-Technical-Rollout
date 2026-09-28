/**
 * Fare Class Rules Manager - ToolJet Custom Component
 * Version: 2.1
 * Architecture matched to FOP Manager v5.0
 *
 * Data binding (triple curly braces):
 * {{{
 *   rules: queries.postgresql_get_filtered_fare_class_rules,
 *   logicOptions: queries.postgresql_fare_class_rules_logic.data,
 *   criteriaOptions: queries.postgresq_condition_criteria.data,
 *   travelerTypes: queries.postgresql_get_traveler_types.data,
 *   smidOptions: queries.postgresql_get_filtered_SMID_menu.data,
 *   lcnOptions: queries.postgresql_get_filtered_lcn_menu.data,
 *   selectedSmid: page.variables.var_selected_SMID,
 *   selectedLcn: page.variables.var_selected_lcn,
 *   canEdit: true,
 *   currentUser: globals.currentUser.firstName,
 *   insertQuery: 'postgresql_insert_fare_class_rule',
 *   updateQuery: 'postgresql_update_fare_class_rule',
 *   deleteQuery: 'postgresql_delete_fare_class_rule',
 *   refreshQuery: 'postgresql_get_filtered_fare_class_rules',
 *   listenerQuery: 'fare_class_rules_air_manager',
 *   _refresh: page.variables.var_policy_refresh_key || 0
 *}}}
 */

import React, { useState, useMemo } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18';

// =============================================================================
// UTILITIES
// =============================================================================

function extractQueryData(q) {
  if (!q) return [];
  if (Array.isArray(q)) return q;
  if (q && Array.isArray(q) && q.data && Array.isArray(q.data)) {
    if (Object.keys(q[0] || {}).length > Object.keys(q.data[0] || {}).length) return q;
  }
  if (q.data && Array.isArray(q.data)) return q.data;
  if (q && Array.isArray(q)) return q;
  return [];
}

function isTruthy(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true','t','1','yes'].indexOf(v.toLowerCase().trim()) > -1;
  return !!v;
}

function parsePgArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(function(v) { return String(v).trim(); }).filter(Boolean);
  var str = String(val).trim();
  // Handle postgres array format: {val1,val2} or {"val 1","val 2"}
  if (str.charAt(0) === '{') str = str.slice(1);
  if (str.charAt(str.length - 1) === '}') str = str.slice(0, -1);
  if (!str) return [];
  // Split on commas, handle quoted values
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

// Normalize a value for comparison (lowercase, trimmed, stripped quotes)
function norm(v) { return String(v || '').trim().toLowerCase().replace(/"/g, ''); }

// =============================================================================
// ICONS
// =============================================================================

var ICO = {
  dom: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V19a1 1 0 001 1h12a1 1 0 001-1V9.5"/></svg>',
  intl: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>',
  llf: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><text x="12" y="14.5" text-anchor="middle" font-size="7" font-weight="600" fill="#6B7280" stroke="none" font-family="-apple-system,BlinkMacSystemFont,sans-serif">LLF</text></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  chk: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
};

function Ico({ name, color }) {
  return <span style={{ display: 'inline-flex', flexShrink: 0, color: color || 'currentColor' }} dangerouslySetInnerHTML={{ __html: ICO[name] || '' }} />;
}

// =============================================================================
// NARRATIVE
// =============================================================================

function buildNarrative(r) {
  return [
    r.condition_1 && r.fare_class_logic_1 && (r.condition_1 + ' is **' + r.fare_class_logic_1 + '**'),
    r.condition_2 && ('**' + r.condition_2 + '** ' + (r.condition_2_criteria || '')),
    r.condition_3 && r.fare_class_logic_2 && (r.condition_3 + ' **' + r.fare_class_logic_2 + '**'),
    r.condition_4 && r.fare_class_logic_3 && (r.condition_4 + ' **' + r.fare_class_logic_3 + '**'),
    r.condition_5 && (r.condition_5 + (r.condition_5_criteria || '')),
    r.condition_6 && r.condition_6
  ].filter(Boolean).join(' : ');
}

function Bold({ text }) {
  if (!text) return null;
  var parts = text.split(/\*\*(.*?)\*\*/g);
  return <span>{parts.map(function(p, i) {
    return i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>;
  })}</span>;
}

function getTitle(r) {
  if (r.condition_1) return r.condition_1;
  if (isTruthy(r.domestic)) return 'Domestic Travel';
  if (isTruthy(r.international)) return 'International Travel';
  if (isTruthy(r.lowest_logical_fare)) return 'Lowest Logical Airfare';
  return 'Rule #' + r.id;
}

// =============================================================================
// SHARED SELECTOR STYLES
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
// SELECTORS
// =============================================================================

function SmidSelector({ smidOptions, selSmids, setSelSmids }) {
  if (!smidOptions || smidOptions.length === 0) return null;
  var toggle = function(id) {
    var sid = String(id);
    setSelSmids(function(prev) { return prev.indexOf(sid) >= 0 ? prev.filter(function(x) { return x !== sid; }) : [].concat(prev, [sid]); });
  };
  // Build a normalized lookup so we can match stored values to option values
  var isSelected = function(optionSmid) {
    var nOpt = norm(optionSmid);
    return selSmids.some(function(sel) { return norm(sel) === nOpt || norm(sel) === norm(optionSmid); });
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

function LcnSelector({ lcnOptions, selLcns, setSelLcns }) {
  if (!lcnOptions || lcnOptions.length === 0) return null;
  var getKey = function(l) { return String(l.lcn_number || l.lcn || l.lcn_name || ''); };
  var getLabel = function(l) { return l.lcn_name || l.lcn_number || l.lcn || ''; };
  var toggle = function(id) {
    var lid = String(id);
    setSelLcns(function(prev) { return prev.indexOf(lid) >= 0 ? prev.filter(function(x) { return x !== lid; }) : [].concat(prev, [lid]); });
  };
  // Normalized matching — stored LCN might be name or number
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

function TravelerTypeSelector({ travelerTypes, selTypes, setSelTypes }) {
  if (!travelerTypes || travelerTypes.length === 0) return null;
  var toggle = function(id) {
    var tid = String(id);
    setSelTypes(function(prev) { return prev.indexOf(tid) >= 0 ? prev.filter(function(x) { return x !== tid; }) : [].concat(prev, [tid]); });
  };
  return (
    <div style={CS.section}>
      <div style={CS.header}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>Traveler Types ({selTypes.length}/{travelerTypes.length})</span>
        <div style={CS.headerActions}>
          <button type="button" style={selectorBtn('#059669')} onClick={function() { setSelTypes(travelerTypes.map(function(t) { return String(t.id); })); }}>Select All</button>
          <span style={CS.sep}>|</span>
          <button type="button" style={selectorBtn('#059669')} onClick={function() { setSelTypes([]); }}>Clear</button>
        </div>
      </div>
      <div style={CS.grid}>
        {travelerTypes.map(function(t) {
          var tid = String(t.id);
          var isSel = selTypes.indexOf(tid) >= 0;
          return (
            <div key={tid} style={Object.assign({}, CS.tag, isSel ? { backgroundColor: '#ecfdf5', borderColor: '#059669' } : {})} onClick={function() { toggle(t.id); }}>
              <span style={checkboxDot(isSel, '#059669')}>{isSel ? <span style={{ color: '#fff', fontSize: '10px' }}>✓</span> : null}</span>
              {t.title || tid}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// FORM CONFIG
// =============================================================================

var BLANK = {
  domestic: false, international: false, lowest_logical_fare: false,
  condition_1: '', fare_class_logic_1: '',
  condition_2: '', condition_2_criteria: '',
  condition_3: '', fare_class_logic_2: '',
  condition_4: '', fare_class_logic_3: '',
  condition_5: '', condition_5_criteria: '',
  condition_6: '',
};

var BF = [
  { k: 'domestic', l: 'Domestic' },
  { k: 'international', l: 'International' },
  { k: 'lowest_logical_fare', l: 'Lowest Logical Fare' },
];

var ROWS = [
  { cond: 'condition_1', logic: 'fare_class_logic_1', condLabel: 'Condition 1', logicLabel: 'Fare Class Logic 1', logicType: 'logic' },
  { cond: 'condition_2', logic: 'condition_2_criteria', condLabel: 'Condition 2', logicLabel: 'Condition 2 Criteria', logicType: 'criteria' },
  { cond: 'condition_3', logic: 'fare_class_logic_2', condLabel: 'Condition 3', logicLabel: 'Fare Class Logic 2', logicType: 'logic' },
  { cond: 'condition_4', logic: 'fare_class_logic_3', condLabel: 'Condition 4', logicLabel: 'Fare Class Logic 3', logicType: 'logic' },
  { cond: 'condition_5', logic: 'condition_5_criteria', condLabel: 'Condition 5', logicLabel: 'Condition 5 Criteria', logicType: 'criteria' },
  { cond: 'condition_6', logic: null, condLabel: 'Condition 6', logicLabel: null, logicType: null },
];

// =============================================================================
// STYLES
// =============================================================================

var border = '#E5E7EB';
var bgAlt = '#F9FAFB';
var blue = '#3B82F6';
var muted = '#9CA3AF';

var labelSt = { fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' };
var inputSt = { padding: '7px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '5px', color: '#1F2937', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%' };
var selectSt = { padding: '7px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '5px', color: '#1F2937', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%', cursor: 'pointer' };

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function FareClassRules(props) {
  var data = props.data || {};
  var updateData = props.updateData;
  var runQuery = props.runQuery;  // ← ToolJet's built-in query runner

  var [editId, setEditId] = useState(null);
  var [adding, setAdding] = useState(false);
  var [delId, setDelId] = useState(null);
  var [form, setForm] = useState(Object.assign({}, BLANK));
  var [editSmids, setEditSmids] = useState([]);
  var [editLcns, setEditLcns] = useState([]);
  var [editTravTypes, setEditTravTypes] = useState([]);
  var [saving, setSaving] = useState(false);

  var rules = useMemo(function() { return extractQueryData(data.rules); }, [data.rules, data._refresh]);
  var logicOptions = useMemo(function() { return Array.isArray(data.logicOptions) ? data.logicOptions : []; }, [data.logicOptions, data._refresh]);
  var criteriaOptions = useMemo(function() { return Array.isArray(data.criteriaOptions) ? data.criteriaOptions : []; }, [data.criteriaOptions, data._refresh]);
  var travelerTypes = useMemo(function() { return Array.isArray(data.travelerTypes) ? data.travelerTypes : []; }, [data.travelerTypes, data._refresh]);
  var smidOptions = useMemo(function() { return Array.isArray(data.smidOptions) ? data.smidOptions : []; }, [data.smidOptions, data._refresh]);
  var lcnOptions = useMemo(function() { return Array.isArray(data.lcnOptions) ? data.lcnOptions : []; }, [data.lcnOptions, data._refresh]);
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

  function onField(k, v) { setForm(function(p) { var n = Object.assign({}, p); n[k] = v; return n; }); }

  function startEdit(r, e) {
    e.stopPropagation();
    setEditId(r.id); setAdding(false); setDelId(null);
    setForm({
      domestic: isTruthy(r.domestic), international: isTruthy(r.international), lowest_logical_fare: isTruthy(r.lowest_logical_fare),
      condition_1: r.condition_1 || '', fare_class_logic_1: r.fare_class_logic_1 || '',
      condition_2: r.condition_2 || '', condition_2_criteria: r.condition_2_criteria || '',
      condition_3: r.condition_3 || '', fare_class_logic_2: r.fare_class_logic_2 || '',
      condition_4: r.condition_4 || '', fare_class_logic_3: r.fare_class_logic_3 || '',
      condition_5: r.condition_5 || '', condition_5_criteria: r.condition_5_criteria || '',
      condition_6: r.condition_6 || '',
    });

    // Parse SMID/LCN from the record; fall back to page variables if empty
    var rSmids = parsePgArray(r.smid);
    var rLcns = parsePgArray(r.lcn);

    // Use record values if present, otherwise fall back to page variables
    setEditSmids(rSmids.length > 0 ? rSmids : parsePgArray(data.selectedSmid));
    setEditLcns(rLcns.length > 0 ? rLcns : parsePgArray(data.selectedLcn));

    // traveler_type_id is a single integer (only stores one)
    // traveler_type is text with ALL names: "Standard Profiled Employee, HCP"
    // Always resolve from traveler_type text to get all selected types
    var ttIds = [];

    if (r.traveler_type) {
      // Split comma-separated names and match each to an ID
      var names = String(r.traveler_type).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      names.forEach(function(name) {
        var n = norm(name);
        travelerTypes.forEach(function(t) {
          if (norm(t.title) === n || norm(t.name) === n) {
            if (ttIds.indexOf(String(t.id)) < 0) {
              ttIds.push(String(t.id));
            }
          }
        });
      });
    }

    // Fallback: if no names matched but we have IDs from the array column, use those
    if (ttIds.length === 0 && r.traveler_type_id) {
      var rawIds = parsePgArray(r.traveler_type_id);
      rawIds.forEach(function(id) {
        if (id && ttIds.indexOf(String(id)) < 0) {
          ttIds.push(String(id));
        }
      });
    }

    setEditTravTypes(ttIds);
  }

  function startAdd() {
    setAdding(true); setEditId(null); setDelId(null);
    setForm(Object.assign({}, BLANK));
    // Pre-select from page variables
    var preSmids = parsePgArray(data.selectedSmid);
    var preLcns = parsePgArray(data.selectedLcn);
    setEditSmids(preSmids);
    setEditLcns(preLcns);
    // Traveler type must be selected — start empty
    setEditTravTypes([]);
  }

  // The listener query name — passed via data binding or defaults
  var listenerQuery = data.listenerQuery || 'fare_class_rules_air_manager';

  var [validationMsg, setValidationMsg] = useState('');

  function doSave() {
    if (saving) return;

    // Validate: traveler type required for new rules
    if (adding && editTravTypes.length === 0) {
      setValidationMsg('Please select a Traveler Type.');
      return;
    }
    setValidationMsg('');
    setSaving(true);

    // Build traveler type names from selected IDs
    var ttNames = [];
    editTravTypes.forEach(function(selId) {
      travelerTypes.forEach(function(t) {
        if (String(t.id) === String(selId)) {
          ttNames.push(t.title || t.name || '');
        }
      });
    });

    // Helper: return null instead of empty string for FK columns
    function nullIfEmpty(v) { return (v && String(v).trim() !== '') ? v : null; }

    var payload = {
      // Booleans
      domestic: form.domestic,
      international: form.international,
      lowest_logical_fare: form.lowest_logical_fare,
      // Text fields — empty string is OK for these
      condition_1: form.condition_1 || null,
      condition_2: form.condition_2 || null,
      condition_3: form.condition_3 || null,
      condition_4: form.condition_4 || null,
      condition_5: form.condition_5 || null,
      condition_6: form.condition_6 || null,
      // FK fields — MUST be null if empty, not empty string
      fare_class_logic_1: nullIfEmpty(form.fare_class_logic_1),
      fare_class_logic_2: nullIfEmpty(form.fare_class_logic_2),
      fare_class_logic_3: nullIfEmpty(form.fare_class_logic_3),
      condition_2_criteria: nullIfEmpty(form.condition_2_criteria),
      condition_5_criteria: nullIfEmpty(form.condition_5_criteria),
      // smid column is text — send ALL selected as Postgres array notation
      smid: editSmids.length > 0 ? '{' + editSmids.join(',') + '}' : null,
      // lcn column is text — send ALL selected as Postgres array notation
      lcn: editLcns.length > 0 ? '{' + editLcns.join(',') + '}' : null,
      // traveler_type — text column, store ALL selected names comma-separated
      // trigger backfills traveler_type_id[] from this
      traveler_type: ttNames.length > 0 ? ttNames.join(', ') : null,
      // meta
      updated_by: data.currentUser || '',
    };

    var isNew = !editId;
    var actionData = {
      action: isNew ? 'add' : 'edit',
      selectedRuleId: editId,
      formData: payload,
    };

    console.log('[FCR] doSave:', actionData.action, 'editId:', editId, 'isNew:', isNew);
    console.log('[FCR] payload:', JSON.stringify(payload));

    // Push form data so queries can read components.xxx.data.formData
    updateData(actionData);

    // Close form immediately
    setEditId(null); setAdding(false); setForm(Object.assign({}, BLANK));
    setEditSmids([]); setEditLcns([]); setEditTravTypes([]);

    // Give updateData time to propagate, then trigger the listener JS query
    setTimeout(function() {
      console.log('[FCR] Firing listener:', listenerQuery, 'runQuery:', !!runQuery);
      if (runQuery) {
        try {
          runQuery(listenerQuery);
          console.log('[FCR] runQuery OK');
        } catch (err) {
          console.error('[FCR] runQuery error:', err);
        }
      }
      setSaving(false);
    }, 300);
  }

  function doDelete(id, e) {
    e.stopPropagation();

    var actionData = { action: 'delete', selectedRuleId: id, formData: {} };

    // Push action + selectedRuleId
    updateData(actionData);
    setDelId(null);

    // Trigger the listener JS query
    setTimeout(function() {
      if (runQuery) {
        try {
          runQuery(listenerQuery);
        } catch (err) {
          console.error('[FCR] runQuery error:', err);
        }
      }
    }, 300);
  }

  function doCancel() {
    setEditId(null); setAdding(false); setDelId(null);
    setForm(Object.assign({}, BLANK));
    setEditSmids([]); setEditLcns([]); setEditTravTypes([]);
    setValidationMsg('');
  }

  // ── Render Logic/Criteria Select ──
  function renderSelect(fieldKey, type) {
    var val = form[fieldKey] || '';
    var options = type === 'logic' ? logicOptions : criteriaOptions;
    var labelKey = type === 'logic' ? 'logic' : 'criteria';
    return (
      <select style={selectSt} value={val} onChange={function(e) { onField(fieldKey, e.target.value); }}>
        <option value="">— Select —</option>
        {options.map(function(o) {
          var label = o[labelKey] || '';
          var display = type === 'logic' ? label + ' (' + (o.lambda_expression || '') + ')' : label;
          return <option key={o.id} value={label}>{display}</option>;
        })}
      </select>
    );
  }

  // ── Render Form ──
  function mkForm(isNew) {
    return (
      <div style={{ margin: '0 12px 8px', border: '1px solid ' + blue, borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderBottom: '1px solid #DBEAFE' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D4ED8' }}>{isNew ? '+ New Fare Class Rule' : 'Edit Fare Class Rule'}</span>
        </div>
        <div style={{ padding: '14px' }}>
          {/* Boolean flags */}
          <div style={{ display: 'flex', gap: '20px', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #F3F4F6' }}>
            {BF.map(function(f) {
              var c = !!form[f.k];
              return (
                <div key={f.k} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }} onClick={function() { onField(f.k, !c); }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, border: c ? '1.5px solid ' + blue : '1.5px solid #D1D5DB', background: c ? blue : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c ? <Ico name="chk" /> : null}
                  </div>
                  <span style={{ fontSize: '13px', color: '#374151' }}>{f.l}</span>
                </div>
              );
            })}
          </div>

          {/* Condition rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {ROWS.map(function(row) {
              var items = [];
              items.push(
                <div key={row.cond} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={labelSt}>{row.condLabel}</label>
                  <input style={inputSt} value={form[row.cond] || ''} placeholder={row.condLabel + '...'} onChange={function(e) { onField(row.cond, e.target.value); }} />
                </div>
              );
              if (row.logic && row.logicType) {
                items.push(
                  <div key={row.logic} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelSt}>{row.logicLabel}</label>
                    {renderSelect(row.logic, row.logicType)}
                  </div>
                );
              } else if (!row.logic) {
                items[0] = (
                  <div key={row.cond} style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: '1 / -1' }}>
                    <label style={labelSt}>{row.condLabel}</label>
                    <input style={inputSt} value={form[row.cond] || ''} placeholder={row.condLabel + '...'} onChange={function(e) { onField(row.cond, e.target.value); }} />
                  </div>
                );
                items.length = 1;
              }
              return items;
            })}
          </div>

          <TravelerTypeSelector travelerTypes={travelerTypes} selTypes={editTravTypes} setSelTypes={setEditTravTypes} />
          {validationMsg ? <div style={{ padding: '6px 10px', fontSize: '12px', color: '#DC2626', fontWeight: 500, background: '#FEF2F2', borderRadius: '4px', border: '1px solid #FECACA' }}>{validationMsg}</div> : null}
          <SmidSelector smidOptions={smidOptions} selSmids={editSmids} setSelSmids={setEditSmids} />
          <LcnSelector lcnOptions={lcnOptions} selLcns={editLcns} setSelLcns={setEditLcns} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px 14px', borderTop: '1px solid ' + border, background: bgAlt }}>
          <button style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer' }} onClick={doCancel}>Cancel</button>
          <button
            style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 500, color: '#fff', background: saving ? '#93C5FD' : blue, border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={doSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : (isNew ? 'Add Rule' : 'Save')}
          </button>
        </div>
      </div>
    );
  }

  // ── Render Card ──
  function mkCard(r) {
    if (editId === r.id) return <div key={r.id}>{mkForm(false)}</div>;

    var t = getTitle(r);
    var n = buildNarrative(r);
    var travTypes = parsePgArray(r.traveler_type);
    var smids = parsePgArray(r.smid);

    return (
      <div key={r.id} style={{ margin: '0 12px 8px', border: '1px solid ' + border, borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: bgAlt, borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isTruthy(r.domestic) ? <Ico name="dom" /> : null}
            {isTruthy(r.international) ? <Ico name="intl" /> : null}
            {isTruthy(r.lowest_logical_fare) ? <Ico name="llf" /> : null}
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>{t}</span>
          </div>
          {canEdit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 4, background: 'transparent', color: muted, cursor: 'pointer' }} title="Edit" onClick={function(e) { startEdit(r, e); }}><Ico name="edit" /></button>
              <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 4, background: 'transparent', color: muted, cursor: 'pointer' }} title="Delete" onClick={function(e) { e.stopPropagation(); setDelId(r.id); }}><Ico name="trash" /></button>
            </div>
          ) : null}
        </div>

        <div style={{ padding: '12px 14px', fontSize: '13px', color: '#374151', lineHeight: '1.7' }}>
          {n ? <Bold text={n} /> : <span style={{ color: muted, fontStyle: 'italic' }}>No conditions defined.</span>}
        </div>

        {(travTypes.length > 0 || smids.length > 0) ? (
          <div style={{ padding: '6px 14px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid #F3F4F6' }}>
            {travTypes.map(function(tt, i) {
              return <span key={'tt' + i} style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#ecfdf5', color: '#059669' }}>{tt}</span>;
            })}
            {smids.length > 0 ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#eff6ff', color: '#3b82f6' }}>{smids.length} SMID{smids.length !== 1 ? 's' : ''}</span> : null}
          </div>
        ) : null}

        {delId === r.id ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#FEF2F2', borderTop: '1px solid #FECACA' }}>
            <span style={{ fontSize: '12px', color: '#991B1B', fontWeight: 500 }}>Delete this rule?</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '5px', cursor: 'pointer' }} onClick={function(e) { e.stopPropagation(); setDelId(null); }}>Cancel</button>
              <button style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, color: '#fff', background: '#EF4444', border: 'none', borderRadius: '5px', cursor: 'pointer' }} onClick={function(e) { doDelete(r.id, e); }}>Delete</button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Main ──
  var cnt = rules.length;
  var sub = cnt > 0 ? cnt + ' rule' + (cnt !== 1 ? 's' : '') + ' defined' : 'No rules defined';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '13px', color: '#1F2937', background: '#fff', overflow: 'hidden' }}>
      {/* FIXED HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid ' + border, background: bgAlt, minHeight: '40px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Fare Class Rules</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{sub}</div>
        </div>
        {canEdit && !adding ? (
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 500, color: '#fff', background: blue, border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={startAdd}>
            <Ico name="plus" /> Add Rule
          </button>
        ) : null}
      </div>

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {adding ? mkForm(true) : null}
        {cnt > 0 ? rules.map(function(r) { return mkCard(r); }) : (
          !adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: muted }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '8px' }}>No fare class rules</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>{canEdit ? 'Click "Add Rule" to create one.' : 'No rules configured.'}</div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CONNECT & RENDER
// =============================================================================

var Connected = Tooljet.connectComponent(FareClassRules);
ReactDOM.render(<Connected />, document.body);
