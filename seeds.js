const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB = path.join(__dirname, 'data', 'app.db');
const db = new sqlite3.Database(DB);

const samples = [
  {
    title: 'Sunny Family Home',
    price: 250000,
    listingType: 'sale',
    beds: 4,
    description: 'Spacious family home with garden and garage. Close to schools and parks.',
    address: '12 Oak Street, Springfield',
    images: [ '/uploads/sample1.svg' ]
  },
  {
    title: 'Modern City Apartment',
    price: 1800,
    listingType: 'rent',
    beds: 2,
    description: 'Bright modern apartment in the city center with concierge and gym access.',
    address: '101 Central Ave, Metropolis',
    images: [ '/uploads/sample2.svg' ]
  },
  {
    title: 'Cozy Studio',
    price: 950,
    listingType: 'rent',
    beds: 1,
    description: 'Compact studio perfect for single professionals. Low utilities and great transport.',
    address: '7 Short Lane, Uptown',
    images: [ '/uploads/sample3.svg' ]
  }
];

db.serialize(() => {
  db.get('SELECT COUNT(*) as c FROM listings', (err, row) => {
    if (err) {
      console.error('DB read error', err);
      process.exit(1);
    }
    if (row && row.c > 0) {
      console.log('Listings already exist; skipping seed.');
      process.exit(0);
    }

    const stmt = db.prepare(`INSERT INTO listings (title, price, listingType, beds, description, address, images, createdAt) VALUES (?,?,?,?,?,?,?,?)`);
    const now = Date.now();
    for (const s of samples) {
      stmt.run(s.title, s.price, s.listingType, s.beds, s.description, s.address, JSON.stringify(s.images), now);
    }
    stmt.finalize(() => {
      console.log('Seeded sample listings.');
      process.exit(0);
    });
  });
});
