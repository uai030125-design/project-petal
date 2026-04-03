/* ── Shared CRM buyer data ──
   Used by both ContactLog and Showroom to connect buyer history with styles.
*/

const BUYER_CARDS = [
  {
    company: 'TJ AU', division: 'Missy Dresses', buyer: 'Jessica Mollee', currentMonth: '5/30',
    history: {
      lastEmail: { date: '2026-03-18', subject: '5/30 Update — POs Raised', summary: 'Jessica raised POs for 5/30 delivery — 2844601 Denim Blue (595 reg + 120 plus) and 7354611 Choc/Ivory Polka Dot (595 reg + 120 plus). 1,430 total units. Pricing: $9 reg / $10 plus. Leslie sending POs by EOD. Size curve: 1:2:2:2 reg, 2:1 plus.' },
      lastVisit: { date: '2026-02-25', subject: 'Sample Drop-off + Meeting Scheduled', summary: 'Kunal dropped off 2 of 3 samples (waiting on polka dot cumberband). Meeting set for March 3 at 12:30pm. Jessica reviewed samples on 2/26 — 9464600 needs pockets + black smocking, 3564601 needs pockets + true navy + better lace quality.' },
      lastTransaction: { shipDate: '2026-05-30', po: '5/30 Delivery', styles: [
        { style: '2844601', description: 'Denim Blue Dress', qty: 715, reads: '' },
        { style: '7354611', description: 'Choc/Ivory Polka Dot Dress', qty: 715, reads: '' },
        { style: '3564601', description: 'Navy Somerset (4/30)', qty: 610, reads: '' },
        { style: '9464600', description: 'Multi Dark Cumberband (4/30)', qty: 490, reads: '' },
        { style: '7574601', description: 'Black Polka Dot (4/30)', qty: 610, reads: '' },
      ]},
      deliveryComments: {
        '4/30': {
          date: '2026-02-26',
          summary: 'Jessica confirmed 4/30 at $9 flat (factory $0.25 upcharge flowed through). Added plus sizes for Navy and Polka Dot — 120 units each (2:1 XL:XXL ratio, $0.40 plus incremental). Reg size curve: 1:2:2:2 (XS,S,M,L) at 490 units per style. Pockets required on all dresses. Samples reviewed 2/26: 9464600 needs pockets + black smocking per image; 3564601 needs pockets, true navy (not black), better lace/crochet quality — current lace looks cut. Jessica sent ME+EM dress as inspo for softer cotton with lace/crochet trims.',
          styles: [
            { style: '3564601', color: 'Navy', qty: 610, cost: '$9.25', notes: 'Add pockets, true navy not black, explore better lace options' },
            { style: '7574601', color: 'Black Polka Dot', qty: 610, cost: '$7.90', notes: 'Add pockets' },
            { style: '9464600', color: 'Multi Dark', qty: 490, cost: '$8.00', notes: 'Add pockets, ensure black smocking per image' },
            { style: '3564601X', color: 'Navy Plus', qty: 120, cost: '$9.65', notes: 'Plus size (XL/XXL)' },
            { style: '7574601X', color: 'Black Polka Dot Plus', qty: 120, cost: '$8.30', notes: 'Plus size (XL/XXL)' },
          ],
        },
        '10/30': {
          date: '2025-09-02',
          summary: 'First deal with TK Australia finalized 9/2/2025. Jessica increased units from original grid and negotiated $0.05 drop on 3874601 and 3184601. UA handles price tickets but ships bulk (24/36 pcs per box, no direct-to-store). Port: New Delhi. All dresses unlined except S/2004601 (cotton voile lining). Jessica sent POs to Lizzy by EOD.',
          styles: [
            { style: '9434600', color: 'Khaki & White', qty: 300, cost: 'Negotiated', notes: 'Print 21-290' },
            { style: '3874601', color: 'Black & White', qty: 480, cost: '$0.05 discount applied', notes: '' },
            { style: '3184601', color: 'Chocolate', qty: 480, cost: '$0.05 discount applied', notes: '' },
            { style: '8404601', color: 'Clear Sky', qty: 300, cost: '', notes: '' },
            { style: '3564601', color: 'High Risk Red', qty: 300, cost: '', notes: '' },
            { style: '5284621', color: 'Loden Frost', qty: 300, cost: '', notes: '' },
          ],
        },
        '11/30': {
          date: '2025-09-02',
          summary: 'Part of initial TK Australia deal. 4 styles for 11/30 delivery, 1,440 total units. Same terms as 10/30 — price tickets included, bulk shipping only.',
          styles: [
            { style: '3564601', color: 'Navy', qty: 480, cost: '', notes: '' },
            { style: '7574601', color: 'Dark Choc & White', qty: 360, cost: '', notes: '' },
            { style: '2004601', color: 'Red & White', qty: 360, cost: '', notes: 'Cotton voile lining' },
            { style: '5284621', color: 'Merlot', qty: 300, cost: '', notes: '' },
          ],
        },
      },
    },
  },
  {
    company: 'DDs', division: 'Scrubs', buyer: 'Traci English', currentMonth: '',
    assistant: 'Victoria Diaz',
    assistantEmail: 'victoria.diaz@ros.com',
    history: {
      lastEmail: { date: '2026-03-18', subject: 'Black / Navy Inventory Close-Out', summary: 'Offered Black/Navy close-out inventory. Victoria (Traci\'s new assistant) reviewed past sales performance with Traci and passed — styles were challenging. Asked to be kept posted on newness. Kunal offered to discuss pricing and turnover impact.' },
      lastVisit: { date: '', subject: '', summary: '' },
      lastTransaction: { shipDate: '', po: '', styles: [] },
    },
  },
  {
    company: 'Gabes', division: 'Scrubs', buyer: 'Amanda Machinowski', currentMonth: '',
    history: {
      lastEmail: { date: '', subject: '', summary: '' },
      lastVisit: { date: '', subject: '', summary: '' },
      lastTransaction: { shipDate: '', po: '', styles: [] },
    },
  },
  {
    company: 'Burlington', division: 'Scrubs', buyer: 'Courtney Z.', currentMonth: '',
    history: {
      lastEmail: { date: '', subject: '', summary: '' },
      lastVisit: { date: '', subject: '', summary: '' },
      lastTransaction: { shipDate: '', po: '', styles: [] },
    },
  },
  {
    company: 'Burlington', division: 'Caftan', buyer: 'Grace Umiker', currentMonth: '',
    history: {
      lastEmail: { date: '03/18/2026', subject: '7/30 caftans', summary: 'Grace asking to confirm caftans for 7/30 ship date. CC: Jordan Gill Behrend, Gabriella Maffie.' },
      lastVisit: { date: '', subject: '', summary: '' },
      lastTransaction: { shipDate: '', po: '', styles: [] },
    },
  },
];

/**
 * Build a lookup: style code → [{ company, buyer, po, shipDate, qty, readsKey }]
 * Normalizes style codes (removes slashes, dashes, spaces) for fuzzy matching
 * between CRM transaction styles and showroom style_numbers.
 */
function normalizeStyle(s) {
  return s.replace(/[\s/\-]/g, '').toUpperCase();
}

function buildStyleOrderMap() {
  const map = {};
  for (const card of BUYER_CARDS) {
    const tx = card.history.lastTransaction;
    if (!tx.po) continue;
    for (const s of tx.styles) {
      const norm = normalizeStyle(s.style);
      if (!map[norm]) map[norm] = [];
      map[norm].push({
        company: card.company,
        buyer: card.buyer,
        po: tx.po,
        shipDate: tx.shipDate,
        qty: s.qty,
        description: s.description,
        readsKey: `${card.company}::${tx.po}::${s.style}`,
      });
    }
  }
  return map;
}

export { BUYER_CARDS, normalizeStyle, buildStyleOrderMap };
export default BUYER_CARDS;
