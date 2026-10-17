// Accepts a small CSV with name, email and mobile/phone columns. Quoted commas and newlines are supported.
export function parseStudentCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === ',') { row.push(cell.trim()); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted value.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('The CSV needs a header and at least one student.');
  const headers = rows.shift().map((value) => value.toLowerCase().replace(/[\s_-]+/g, ''));
  const column = (names) => headers.findIndex((header) => names.includes(header));
  const name = column(['name', 'studentname', 'fullname']);
  const email = column(['email', 'emailaddress']);
  const phone = column(['phone', 'mobile', 'mobilenumber', 'phonenumber']);
  if (name < 0 || (email < 0 && phone < 0)) throw new Error('Use columns name and email or mobile.');
  if (rows.length > 200) throw new Error('Upload up to 200 students at a time.');
  return rows.map((cells, index) => {
    const student = { name: cells[name] || '', email: email < 0 ? '' : cells[email] || '', phone: phone < 0 ? '' : cells[phone] || '' };
    if (!student.name || (!student.email && !student.phone)) throw new Error(`Row ${index + 2} needs a name and email or mobile.`);
    return student;
  });
}
