// The ghost hunt: what happened when, for Ch1 §7 (Widget "The ghost hunt").
// Every line here is checked against a source; see ./spec.md ("Sources").
// `y` places the event on the time axis (fractional years); `date` is what the reader sees.
// `lvl` is the label height on wide screens (1 = lowest); `end` puts the label left of its stem.
// In `text`, *asterisks* mark italics (a journal title).
// Events with `hunt: true` sit in the row above the axis. `photo` names files in ./photos/
// (<photo>.jpg, <photo>-thumb.jpg); every photo needs its credit and licence in ./spec.md.

export const START = 1910, END = 1960;
export const GAP = [1930.9, 1956.5];   // Pauli's letter → detection: the twenty-six empty years

export const EVENTS = [
  { id: 'chadwick', y: 1914, date: '1914', who: 'Chadwick', lvl: 2,
    title: 'A spread, not a line',
    text: 'James Chadwick measures the electrons from beta decay. Their energies spread out instead of sitting at one value. Many suspect the measurement.' },
  { id: 'ellis', y: 1927, date: '1927', who: 'Ellis & Wooster', lvl: 1, end: true,
    title: 'The spread is real',
    text: 'Charles Ellis and William Wooster catch all the heat from decaying radium E. It matches the electrons’ average energy, not the full amount. Nothing is hiding in the apparatus.' },
  { id: 'bohr', y: 1929.8, date: '1929–30', who: 'Bohr', lvl: 2, end: true,
    title: 'Give up the law?',
    text: 'Niels Bohr is ready to consider that, inside the atom, energy is kept only on average.' },
  { id: 'pauli', y: 1930.9, date: '4 Dec 1930', who: 'Pauli', lvl: 3,
    title: 'A desperate remedy',
    text: 'In a letter to the “radioactive ladies and gentlemen” meeting in Tübingen, Wolfgang Pauli proposes an unseen neutral particle that carries off the missing energy. He calls it a “neutron.”' },
  { id: 'fermi', y: 1933.9, date: '1933–34', who: 'Fermi', lvl: 1,
    title: 'A theory and a name',
    text: 'Enrico Fermi builds Pauli’s guess into a working theory of beta decay. The particle becomes the neutrino, “little neutral one.”' },
  { id: 'poltergeist', y: 1952.5, date: '1952–53', hunt: true, short: 'Poltergeist',
    title: 'Project Poltergeist',
    text: 'At Los Alamos, Clyde Cowan and Frederick Reines name their hunt for the ghost particle Project Poltergeist.',
    photo: 'poltergeist', photoAlt: 'Cowan (far left), Reines (far right) and the Project Poltergeist team around their detector, holding a sign with an eye on it.', credit: 'Los Alamos National Laboratory' },
  { id: 'auge', y: 1953.4, date: '1953', hunt: true, short: 'Herr Auge',
    title: '“Herr Auge”',
    text: 'Their prototype detector is nicknamed “Herr Auge,” Mr. Eye. A larger one, beside a reactor at Hanford, Washington, gives a probable sighting, not proof.',
    photo: 'herr-auge', photoAlt: 'The prototype detector “Herr Auge”: a drum ringed with photomultiplier tubes; its lid reads “Entombed March 12, 1953.”', credit: 'Los Alamos National Laboratory' },
  { id: 'caught', y: 1956.5, date: '1955–56', hunt: true, short: 'Caught',
    title: 'Caught',
    text: 'The team moves to a stronger, better-shielded reactor at Savannah River, South Carolina. In 1956 they detect the neutrino; *Science* publishes it on 20 July.',
    photo: 'controls', photoAlt: 'Reines (left, reading) and Cowan at the controls of the Savannah River experiment, 1956.', credit: 'Los Alamos National Laboratory' },
];

// The three dates the folded (phone) strip names.
export const MILESTONES = [[1914, '1914', 'puzzle'], [1930.9, '1930', 'Pauli'], [1956.5, '1956', 'caught']];

export const x01 = (y) => (y - START) / (END - START);   // 0..1 along the axis
export const gapYears = () => Math.round(GAP[1] - GAP[0]);
