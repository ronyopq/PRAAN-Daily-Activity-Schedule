/*** === CONFIG === ***/
const SHEET_NAME = 'Sheet1'; // আপনার শিট ট্যাবের নাম
const TOKEN = 'CHANGE_ME_SECURE_TOKEN'; // শক্তিশালী টোকেন বসান
const GOOGLE_CLIENT_ID = 'CHANGE_ME_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // আপনার Google Client ID

/*** === HELPERS === ***/
function _sheet() { return SpreadsheetApp.getActive().getSheetByName(SHEET_NAME); }
function _headers() { return _sheet().getRange(1,1,1,_sheet().getLastColumn()).getValues()[0]; }
function _findRowById(id) {
  const sh=_sheet();
  const last=sh.getLastRow(); if (last<2) return -1;
  const values = sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
  for (let i=0;i<values.length;i++){ if (String(values[i][0]) === String(id)) return i+2; }
  return -1;
}
function _cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-ID-TOKEN'
  };
}
function _jsonResponse(obj, status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  const headers = _cors();
  const resp = out; // Apps Script doesn't allow direct setHeaders on text output, but doGet/doPost can use HtmlService? We'll proceed with setMimeType.
  return out;
}

function _verifyGoogleIdToken(idToken) {
  if (!idToken) throw new Error('Missing idToken');
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const r = UrlFetchApp.fetch(url, { 'muteHttpExceptions': true });
  if (r.getResponseCode() !== 200) throw new Error('Invalid Google ID token');
  const info = JSON.parse(r.getContentText());
  if (info.aud !== GOOGLE_CLIENT_ID) throw new Error('Invalid audience');
  if (String(info.email_verified) !== 'true') throw new Error('Email not verified');
  return { email: info.email, name: info.name, picture: info.picture, sub: info.sub };
}

function doOptions(e){
  return _jsonResponse({ok:true});
}

function doGet(e){
  const p = e.parameter || {};
  const action = p.action || 'list';
  const token = p.token || '';
  const idToken = e && e.parameter && e.parameter['idToken'] ? e.parameter['idToken'] : (e && e.headers && e.headers['X-ID-TOKEN']);
  // Apps Script doGet doesn't expose headers; accept via query only for GET
  const idTok = p.idToken || '';
  if (token !== TOKEN) return _jsonResponse({ok:false, error:'Unauthorized'});
  let user;
  try { user = _verifyGoogleIdToken(idTok); } catch(err) { return _jsonResponse({ok:false, error:'Auth failed: '+err.message}); }

  const sh = _sheet(); const headers = _headers();
  if (action === 'list') {
    const targetDate = p.date || '';
    const mine = String(p.mine||'') === 'true';
    const dateFrom = p.dateFrom || ''; const dateTo = p.dateTo || '';
    const last = sh.getLastRow(); const dataRange = last>1 ? sh.getRange(2,1,last-1,sh.getLastColumn()).getValues() : [];
    const rows = dataRange.map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i]])));
    const filtered = rows.filter(rec => {
      let ok = true;
      if (targetDate) ok = ok && String(rec.Date) === targetDate;
      if (dateFrom) ok = ok && String(rec.Date) >= dateFrom;
      if (dateTo) ok = ok && String(rec.Date) <= dateTo;
      if (mine) ok = ok && String(rec.CreatedBy||'') === user.email;
      return ok;
    });
    return _jsonResponse({ok:true, data:filtered});
  }
  return _jsonResponse({ok:false, error:'Unknown action'});
}

function doPost(e){
  const body = e.postData ? JSON.parse(e.postData.contents||'{}') : {};
  const token = body.token || '';
  if (token !== TOKEN) return _jsonResponse({ok:false, error:'Unauthorized'});
  let user;
  try { user = _verifyGoogleIdToken(body.idToken); } catch(err) { return _jsonResponse({ok:false, error:'Auth failed: '+err.message}); }

  const action = body.action;
  if (!action) return _jsonResponse({ok:false, error:'Missing action'});
  const sh = _sheet(); const headers = _headers(); const now = new Date();

  if (action === 'create') {
    const id = Utilities.getUuid();
    const row = [
      id,
      body.Date || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      body.Time || '',
      body.Activity || '',
      body.Output || '',
      body.FollowUp || '',
      body.Comment || '',
      body.Notes || '',
      body.Delivery || '',
      user.email,
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      ''
    ];
    sh.appendRow(row);
    return _jsonResponse({ok:true, id, createdBy:user.email});
  }

  if (action === 'update') {
    const id = body.ID; if (!id) return _jsonResponse({ok:false, error:'Missing ID'});
    const rowIndex = _findRowById(id); if (rowIndex < 0) return _jsonResponse({ok:false, error:'ID not found'});
    const existing = sh.getRange(rowIndex,1,1,headers.length).getValues()[0];
    const map = Object.fromEntries(headers.map((h,i)=>[h, existing[i]]));
    if (String(map['CreatedBy']||'') !== user.email) return _jsonResponse({ok:false, error:'Permission denied'});
    Object.keys(body).forEach(k=>{ if (!['action','token','idToken','ID'].includes(k)) map[k] = body[k]; });
    map['UpdatedAt'] = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const updatedRow = headers.map(h => map[h] ?? '');
    sh.getRange(rowIndex,1,1,headers.length).setValues([updatedRow]);
    return _jsonResponse({ok:true, id});
  }

  if (action === 'delete') {
    const id = body.ID; if (!id) return _jsonResponse({ok:false, error:'Missing ID'});
    const rowIndex = _findRowById(id); if (rowIndex < 0) return _jsonResponse({ok:false, error:'ID not found'});
    const existing = sh.getRange(rowIndex,1,1,headers.length).getValues()[0];
    const map = Object.fromEntries(headers.map((h,i)=>[h, existing[i]]));
    if (String(map['CreatedBy']||'') !== user.email) return _jsonResponse({ok:false, error:'Permission denied'});
    sh.deleteRow(rowIndex);
    return _jsonResponse({ok:true, id});
  }

  return _jsonResponse({ok:false, error:'Unknown action'});
}
