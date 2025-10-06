# SwapCycle - Node + TypeScript (SQLite) - Importable Project

This project is a complete Node.js + TypeScript backend MVP for SwapCycle using Express + Prisma (SQLite) with JWT auth, listings, and swap offers. Save this project as a folder and run locally.

---

## File tree

```
swapcycle-node-mvp/
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ README.md
├─ prisma/
│  └─ schema.prisma
└─ src/
   ├─ server.ts
   ├─ prisma.ts
   ├─ middleware/
   │  └─ auth.ts
   ├─ routes/
   │  ├─ auth.ts
   │  ├─ listings.ts
   │  └─ offers.ts
   └─ types.d.ts
```

---

## package.json

```json
{
  "name": "swapcycle-node-mvp",
  "version": "1.0.0",
  "private": true,
  "main": "src/server.ts",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma": "prisma"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.0",
    "multer": "^1.4.5-lts.1",
    "prisma": "^5.10.1",
    "@prisma/client": "^5.10.1"
  },
  "devDependencies": {
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.9.0"
  }
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

---

## .env.example

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change_this_to_a_long_secret"
PORT=3000
```

---

## prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id         String    @id @default(uuid())
  email      String    @unique
  password   String
  name       String?
  avatarUrl  String?
  bio        String?
  listings   Listing[] @relation("OwnerListings")
  offersMade SwapOffer[] @relation("Proposer")
  ratings    Rating[]
  createdAt  DateTime  @default(now())
}

model Listing {
  id         String    @id @default(uuid())
  owner      User      @relation(fields: [ownerId], references: [id], name: "OwnerListings")
  ownerId    String
  title      String
  description String?
  category   String?
  condition  String?
  isActive   Boolean   @default(true)
  images     ListingImage[]
  offers     SwapOffer[]
  createdAt  DateTime  @default(now())
}

model ListingImage {
  id        String   @id @default(uuid())
  listing   Listing  @relation(fields: [listingId], references: [id])
  listingId String
  url       String
  ordinal   Int      @default(0)
}

model SwapOffer {
  id          String   @id @default(uuid())
  listing     Listing  @relation(fields: [listingId], references: [id])
  listingId   String
  proposer    User     @relation(fields: [proposerId], references: [id], name: "Proposer")
  proposerId  String
  offeredText String?
  status      String   @default("pending") // pending / accepted / rejected / completed
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Rating {
  id        String   @id @default(uuid())
  rater     User     @relation(fields: [raterId], references: [id])
  raterId   String
  ratee     User     @relation(fields: [rateeId], references: [id])
  rateeId   String
  listing   Listing? @relation(fields: [listingId], references: [id])
  listingId String?
  score     Int
  comment   String?
  createdAt DateTime @default(now())
}
```

---

## src/prisma.ts

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export default prisma;
```

---

## src/types.d.ts

```ts
import express from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}
```

---

## src/middleware/auth.ts

```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Bad Authorization' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

## src/routes/auth.ts

```ts
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';

router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed, name } });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
```

---

## src/routes/listings.ts

```ts
import express from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Create listing
router.post('/', requireAuth, async (req, res) => {
  const { title, description, category, condition, images } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        category,
        condition,
        ownerId: req.user!.id,
        images: { create: (images || []).map((url: string, i: number) => ({ url, ordinal: i })) }
      },
      include: { images: true }
    });
    res.json(listing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List with optional filters
router.get('/', async (req, res) => {
  const { q, category } = req.query as any;
  const where: any = { isActive: true };
  if (category) where.category = category;
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
  try {
    const listings = await prisma.listing.findMany({ where, include: { images: true, owner: { select: { id: true, email: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(listings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get by id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const listing = await prisma.listing.findUnique({ where: { id }, include: { images: true, owner: { select: { id: true, email: true, name: true } }, offers: true } });
    if (!listing) return res.status(404).json({ error: 'Not found' });
    res.json(listing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit listing
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, category, condition, isActive } = req.body;
  try {
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return res.status(404).json({ error: 'Not found' });
    if (listing.ownerId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.listing.update({ where: { id }, data: { title, description, category, condition, isActive } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete listing
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return res.status(404).json({ error: 'Not found' });
    if (listing.ownerId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.listing.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
```

---

## src/routes/offers.ts

```ts
import express from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Propose an offer for a listing
router.post('/:listingId', requireAuth, async (req, res) => {
  const { listingId } = req.params;
  const { offeredText } = req.body;
  try {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.ownerId === req.user!.id) return res.status(400).json({ error: 'Cannot offer on your own listing' });
    const offer = await prisma.swapOffer.create({ data: { listingId, proposerId: req.user!.id, offeredText } });
    res.json(offer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Owner accepts/rejects offer
router.patch('/:offerId', requireAuth, async (req, res) => {
  const { offerId } = req.params;
  const { action } = req.body; // 'accept' | 'reject' | 'complete'
  try {
    const offer = await prisma.swapOffer.findUnique({ where: { id: offerId }, include: { listing: true } });
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.listing.ownerId !== req.user!.id) return res.status(403).json({ error: 'Only owner can act' });
    let status = offer.status;
    if (action === 'accept') status = 'accepted';
    else if (action === 'reject') status = 'rejected';
    else if (action === 'complete') status = 'completed';
    const updated = await prisma.swapOffer.update({ where: { id: offerId }, data: { status } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get offers for current user (as owner and proposer)
router.get('/', requireAuth, async (req, res) => {
  try {
    const asProposer = await prisma.swapOffer.findMany({ where: { proposerId: req.user!.id }, include: { listing: true } });
    const asOwner = await prisma.swapOffer.findMany({ where: { listing: { ownerId: req.user!.id } }, include: { listing: true } });
    res.json({ asProposer, asOwner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
```

---

## src/server.ts

```ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import listingsRoutes from './routes/listings';
import offersRoutes from './routes/offers';
import prisma from './prisma';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/listings', listingsRoutes);
app.use('/offers', offersRoutes);

app.get('/', (req, res) => res.json({ ok: true, msg: 'SwapCycle API' }));

const port = Number(process.env.PORT || 3000);
app.listen(port, async () => {
  console.log(`Server listening on http://localhost:${port}`);
  // lightweight check
  try {
    await prisma.$connect();
    console.log('Prisma connected');
  } catch (err) {
    console.error('Prisma connect error', err);
  }
});
```

---

## README.md (run instructions)

```md
# SwapCycle - Node + TypeScript (SQLite) - Backend MVP

## Quick start

1. Copy the project folder.
2. Create a `.env` file from `.env.example` and adjust values.

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

3. API will run at `http://localhost:3000`.

## Notes
- This demo stores images as URLs in the listing.images array. Replace with S3/Cloudinary for production uploads.
- JWT secret must be changed in production.
- SQLite is used for local/demo; switch to PostgreSQL for production by changing `prisma/schema.prisma` datasource.
```

---








