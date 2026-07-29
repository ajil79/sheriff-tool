// Feeds Chris's real LEAP / licence samples through the actual paste path
// (#swPaste -> parseOCR -> fillOffenderFields) and reports what the tool extracts.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const html = fs.readFileSync((process.argv[2] || __dirname + '/../index.html'), 'utf8');

const LEAP = (n, d, s, a, p, cls, st, exp, extra = '') => `
====================LEAP DATABASE ENTRY====================
    NAME:          ${n}
    DOB:           ${d}
    SEX:           ${s}
    HOME ADDR:     ${a}
    PHONE NO:      ${p}

==================ROAD TRAFFIC AUTHORITY==================
    LIC CLASS:     ${cls}      LIC STATUS:      ${st}
    EXPIRES:       ${exp}

    CONDITIONS:    NONE
    DEMERIT PTS:   0 (LAST 7 DAYS)

====================     FLAGS     ====================
    WANTED:        ${extra || 'NO'}
    BAIL:          NO
    GANG AFF:      NO      VIOLENCE POLICE:    NO
    POS WEAP:      NO      VIOLENCE:           NO
`;

const LICENCE = (name, addr, expiry, dob, type) => `
DRIVER LICENCE
VICTORIA AUSTRALIA
${name}
${addr}
LICENCE EXPIRY   DATE OF BIRTH
${expiry}        ${dob}
LICENCE TYPE
${type}
`;

const CASES = [
  { label: 'LEAP  Vasquez',  expectName: 'Harley Vasquez',  expectDob: '1995-4-3',
    text: LEAP('VASQUEZ, HARLEY', '1995-4-3', 'M', 'VINEWOOD, LOS SANTOS', '330201', 'CAR', 'CURRENT', '2025-12-18 23:56 PM') },
  { label: 'LEAP  Robinson',  expectName: 'Bernard Robinson', expectDob: '1988-1-28',
    text: LEAP('ROBINSON, BERNARD', '1988-1-28', 'M', 'VESPUCCI CANALS, LOS SANTOS', '941101', 'CAR HEAVY COMBIN', 'EXPIRED', '2022-11-07 10:16 AM') },
  { label: 'LEAP  Loo',       expectName: 'Han Loo', expectDob: '1996-4-7',
    text: LEAP('LOO, HAN', '1996-4-7', 'M', 'SANDY SHORES, BLAINE COUNTY', '226739', 'CAR', 'EXPIRED', '2022-07-12 00:37 AM') },
  { label: 'LEAP  Baaler',    expectName: 'Baasta Baaler', expectDob: '1920-7-20',
    text: LEAP('BAALER, BAASTA', '1920-7-20', 'M', 'VICROADS 140', '690690', 'CAR RIDER HEAVY COMBIN', 'CURRENT', '2025-10-20 01:31 AM') },
  { label: 'LEAP  Briggs',    expectName: 'Stezzy Briggs', expectDob: '1991-3-26',
    text: LEAP('BRIGGS, STEZZY', '1991-3-26', 'M', 'BURTON, LOS SANTOS', '679042', 'CAR HEAVY COMBIN', 'CURRENT', '2026-08-09 12:59 PM') },
  { label: 'LEAP  McLovin*',  expectName: 'Bobby Mclovin', expectDob: '1987-1-20',
    text: LEAP('MCLOVIN, BOBBY', '1987-1-20', 'M', 'LITTLE SEOUL, LOS SANTOS', '1717', 'CAR RIDER HEAVY COMBIN', 'CURRENT', '2026-08-17 00:08 AM', 'YES              [ACTIVE CRIMINAL WARRANT]') },
  { label: 'LIC   Robinson',  expectName: 'Bernard Robinson', expectDob: '28-01-1988',
    text: LICENCE('BERNARD ROBINSON', 'VESPUCCI CANALS, LOS SANTOS', '07-11-2022', '28-01-1988', 'C HC WL') },
  { label: 'LIC   Baaler',    expectName: 'Baasta Baaler', expectDob: '20-07-1920',
    text: LICENCE('BAASTA BAALER', 'VICROADS 140', '20-10-2025', '20-07-1920', 'C R HC WL') },
  { label: 'LIC   Von-Schweetz', expectName: 'Lily Von-Schweetz', expectDob: '27-04-1999',
    text: LICENCE('LILY VON-SCHWEETZ', 'LIVE IN CELL 19 IN THE MRC', '31-08-2025', '27-04-1999', 'R HC WL') },
  { label: 'LIC   Violet',    expectName: 'Maeve Violet', expectDob: '17-05-1996',
    text: LICENCE('MAEVE VIOLET', 'CERTIFIED CRAYON EATER', '22-02-2026', '17-05-1996', 'C R HC WL') },
];

(async () => {
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc });
  const { window } = dom, d = window.document;
  await sleep(500);

  const set = (id, v) => { const e = d.getElementById(id); if (!e) return; e.value = v;
    e.dispatchEvent(new window.Event('input', { bubbles: true }));
    e.dispatchEvent(new window.Event('change', { bubbles: true })); };
  const val = id => { const e = d.getElementById(id); return e ? e.value : '(no el)'; };

  console.log('name'.padEnd(19) + 'extracted name'.padEnd(20) + 'DOB'.padEnd(13) + 'addr'.padEnd(30) + 'phone'.padEnd(8) + 'lic class');
  console.log('─'.repeat(112));
  const issues = [];
  for (const c of CASES) {
    // reset the fields we read
    ['offenderName','offenderDOB','offenderAddress','offenderPhone','swPaste'].forEach(i => set(i, ''));
    await sleep(60);
    set('swPaste', c.text);
    await sleep(220);
    const got = { name: val('offenderName'), dob: val('offenderDOB'),
                  addr: val('offenderAddress'), phone: val('offenderPhone'),
                  cls: (d.getElementById('licenseClass') || {}).value ?? '' };
    console.log(c.label.padEnd(19) + String(got.name).padEnd(20) + String(got.dob).padEnd(13) +
                String(got.addr).slice(0,28).padEnd(30) + String(got.phone).padEnd(8) + got.cls);
    if (got.name !== c.expectName) issues.push(`${c.label}: name "${got.name}" != "${c.expectName}"`);
  }
  console.log('\npage errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  console.log(issues.length ? '\nNAME MISMATCHES:\n  ' + issues.join('\n  ') : '\nall names correct');
  window.close();
})();
