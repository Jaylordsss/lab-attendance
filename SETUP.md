# Where these files go

Copy the contents of this folder into your `lab-attendance` repo root,
keeping the same structure.

    lab-attendance/
    ├── CLAUDE.md
    ├── SETUP.md                 (this file, delete after reading)
    ├── .gitignore               (merge with the existing one)
    ├── .env.local.example
    ├── db/
    │   └── schema.sql
    ├── lib/
    │   └── qr-token.ts
    └── app/
        └── api/
            └── attendance/
                └── scan/
                    └── route.ts

## If your project uses src/

Run `ls -d app src/app` in the repo root. If it prints `src/app`, move
two folders inside `src/`:

    src/lib/qr-token.ts
    src/app/api/attendance/scan/route.ts

`CLAUDE.md`, `.gitignore`, `.env.local.example` and `db/` stay at the root
either way.

## Steps

1. Copy files in, keeping the tree above.
2. `npm i @supabase/supabase-js @zxing/browser pdf-lib`
3. Check `tsconfig.json` has a matching alias:
       "paths": { "@/*": ["./*"] }        // lib/ at root
       "paths": { "@/*": ["./src/*"] }    // lib/ in src/
4. `cp .env.local.example .env.local` then fill in your Supabase keys.
5. Verify it is ignored:  `git check-ignore -v .env.local`
   No output means your .gitignore is wrong. Fix before committing.
6. Paste `db/schema.sql` into the Supabase SQL Editor and run it.
7. `git status` — confirm .env.local is NOT listed. Then commit.
