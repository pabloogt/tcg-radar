# TCG Radar

## Product objective

Build a private web application that monitors sealed TCG products and detects buying opportunities.

Supported TCGs for the MVP:

- Pokémon
- One Piece
- Disney Lorcana

The application must help the user identify:

- Short-term resale opportunities
- Medium-term investment opportunities
- Long-term sealed-product opportunities

## MVP scope

The first version must include:

- Private authentication
- Product watchlist
- Store listings
- Price history
- Opportunity calculator
- Inventory
- Telegram alerts
- One or two simple store monitors

Do not implement:

- Wallapop scraping
- Large-scale Amazon scraping
- Payments
- Subscriptions
- Multi-user administration
- Native mobile apps
- AI price predictions

## Technology

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Zod
- React Hook Form
- Vitest for business-logic tests

## Development rules

- Use strict TypeScript.
- Never use `any`.
- Validate external inputs with Zod.
- Prefer Server Components.
- Use Client Components only when interactivity requires them.
- Keep financial calculations in pure functions.
- Add tests for financial calculations.
- Do not commit secrets.
- Never expose the Supabase service role key to the browser.
- Keep the application responsive.
- Use euros as the default currency.
- Store monetary values as integer cents.
- Run lint, tests and type checking after each feature.
- Do not add dependencies without explaining why.
- Do not rewrite unrelated working code.

## Core entities

- users
- products
- stores
- listings
- price_history
- purchases
- sales
- alerts

## Product fields

A product should support:

- TCG
- Name
- Set name
- Product type
- Language
- Release date
- Recommended retail price
- Image
- Reprint risk
- Demand score
- Long-term score

## Listing fields

A listing should support:

- Product
- Store
- URL
- Current price
- Shipping cost
- Stock status
- Last checked date
- Seller
- Country

## Financial outputs

Always calculate:

- Total acquisition cost
- Expected selling costs
- Net profit
- ROI
- Break-even sale price
- Maximum purchase price
- Estimated holding period

## Opportunity horizons

- Short term: immediate resale or less than 3 months
- Medium term: 3 to 18 months
- Long term: more than 18 months

## Working method

Before implementing a large feature:

1. Inspect the existing repository.
2. Explain the proposed approach.
3. Identify files to create or modify.
4. Implement only the requested feature.
5. Run validation commands.
6. Summarize changes and remaining risks.
