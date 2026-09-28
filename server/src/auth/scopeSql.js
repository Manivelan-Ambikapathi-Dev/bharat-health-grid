import { ROLES } from '../constants/roles.js';

function isNational(access) {
  return !access || access.role === ROLES.NATIONAL_ADMIN;
}

function appendScope(conditions, params, access, aliases = { state: 's', district: 'd', phc: 'p' }) {
  if (isNational(access)) {
    return;
  }
  if (access.stateId) {
    conditions.push(`${aliases.state}.id = :scopeStateId`);
    params.scopeStateId = access.stateId;
  }
  if (access.role === ROLES.DISTRICT_OFFICER || access.role === ROLES.PHC_STAFF) {
    conditions.push(`${aliases.district}.id = :scopeDistrictId`);
    params.scopeDistrictId = access.districtId;
  }
  if (access.role === ROLES.PHC_STAFF) {
    conditions.push(`${aliases.phc}.id = :scopePhcId`);
    params.scopePhcId = access.phcId;
  }
}

function scopeAnd(access, aliases) {
  const conditions = [];
  const params = {};
  appendScope(conditions, params, access, aliases);
  return {
    sql: conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '',
    params,
  };
}

function rowInScope(row, access) {
  if (isNational(access)) {
    return true;
  }
  if (access.stateName && row.state && row.state !== access.stateName) {
    return false;
  }
  if ((access.role === ROLES.DISTRICT_OFFICER || access.role === ROLES.PHC_STAFF)
    && access.districtName
    && row.district
    && row.district !== access.districtName) {
    return false;
  }
  if (access.role === ROLES.PHC_STAFF && access.phcName) {
    const phcName = row.phc || row.phc_name;
    if (phcName && phcName !== access.phcName) {
      return false;
    }
  }
  return true;
}

function filterRowsByScope(rows, access) {
  if (isNational(access)) {
    return rows;
  }
  return rows.filter((row) => rowInScope(row, access));
}

export { appendScope, scopeAnd, rowInScope, filterRowsByScope, isNational };
