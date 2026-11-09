function readRows(text, delimiter) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i+1] === '"') {field += '"'; i++;}
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (char === '\n') {rows.push(row); row = [];}
    } else field += char;
  }
  if (row.length || field) rows.push([...row, field.replace(/\r$/, '')]);
  return rows;
}

export function parseChairs(text, party, precincts) {
  const [header = [], ...rows] = readRows(text.replace(/^\uFEFF/, ''), party === 'REP' ? ',' : '\t');
  const name = header.indexOf(party === 'REP' ? 'Ballot Name' : 'Name');
  const id = header.indexOf(party === 'REP' ? 'Precinct' : '');
  const comments = header.indexOf('Comments');
  if (id < 0 || name < 0) throw new Error('This file does not match the selected party’s roster format.');
  const result = Object.create(null);
  for (const row of rows) {
    const precinct = row[id]?.trim();
    if (!precincts.has(precinct)) continue;
    const value = row[name]?.trim();
    const vacant = /^(open|empty|vacant)$/i.test(value) || /^empty$/i.test(row[comments]?.trim());
    if (value || vacant) result[precinct] = vacant ? 'Vacant' : value;
  }
  if (!Object.keys(result).length) throw new Error('No roster entries matched dashboard precincts.');
  return result;
}

export function setupChairs(host, precincts, onChange) {
  const status = host.querySelector('[role=status]');
  const rosters = {};
  for (const input of host.querySelectorAll('input[type=file]')) {
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const party = input.dataset.party;
      const label = party === 'DEM' ? 'Democratic' : 'Republican';
      try {
        const roster = parseChairs(await file.text(), party, precincts);
        rosters[party] = roster;
        status.textContent = `${label} roster loaded · ${Object.keys(roster).length} precincts.`;
        onChange(rosters);
      } catch (error) {
        status.textContent = `${label} roster · ${error.message}`;
      }
      input.value = '';
    };
  }
}
