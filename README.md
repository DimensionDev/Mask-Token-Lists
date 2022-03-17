# Mask Token Lists

The token lists for Mask Network.

- List Name: Mask Network
- Link to the official homepage of the list manager: <https://mask.io>

## Setup

```bash
yarn # install dependencies
yarn build # build token lists
```

## Steps for new chain

- Add the chain id in [types.ts](src/types.ts).
- Add your token lists into [src/fungible-tokens/](src/fungible-tokens/) or
  [src/non-fungible-tokens/](src/non-fungible-tokens/).
- Run `yarn build` to ensure everything is working great.
- Don't forget to bump version in `package.json`.
- Update below two tables in README file here.
- Risk a pull request in this repository.

## Versions based on chain id

| Chain      | Chain Id   | Link                                                           | Viewer                                                                                                   |
| ---------- | ---------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Mainnet    | 1          | [latest](https://tokens.r2d2.to/latest/1/tokens.json)          | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1/tokens.json)          |
| Ropsten    | 3          | [latest](https://tokens.r2d2.to/latest/3/tokens.json)          | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/3/tokens.json)          |
| Rinkeby    | 4          | [latest](https://tokens.r2d2.to/latest/4/tokens.json)          | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/4/tokens.json)          |
| Optimistic | 10         | [latest](https://tokens.r2d2.to/latest/10/tokens.json)         | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/10/tokens.json)         |
| BSC        | 56         | [latest](https://tokens.r2d2.to/latest/56/tokens.json)         | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/56/tokens.json)         |
| BSC Test   | 97         | [latest](https://tokens.r2d2.to/latest/97/tokens.json)         | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/97/tokens.json)         |
| xDai       | 100        | [latest](https://tokens.r2d2.to/latest/100/tokens.json)        | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/100/tokens.json)        |
| Fuse       | 122        | [latest](https://tokens.r2d2.to/latest/122/tokens.json)        | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/122/tokens.json)        |
| Matic      | 137        | [latest](https://tokens.r2d2.to/latest/97/tokens.json)         | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/137/tokens.json)        |
| Mumbai     | 80001      | [latest](https://tokens.r2d2.to/latest/80001/tokens.json)      | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/80001/tokens.json)      |
| Fantom     | 250        | [latest](https://tokens.r2d2.to/latest/250/tokens.json)        | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/250/tokens.json)        |
| Boba       | 288        | [latest](https://tokens.r2d2.to/latest/288/tokens.json)        | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/288/tokens.json)        |
| Arbiturm   | 42161      | [latest](https://tokens.r2d2.to/latest/42161/tokens.json)      | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/42161/tokens.json)      |
| CELO       | 42220      | [latest](https://tokens.r2d2.to/latest/42220/tokens.json)      | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/42220/tokens.json)      |
| Avalanche  | 43114      | [latest](https://tokens.r2d2.to/latest/43114/tokens.json)      | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/43114/tokens.json)      |
| Aurora     | 1313161554 | [latest](https://tokens.r2d2.to/latest/1313161554/tokens.json) | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1313161554/tokens.json) |
| HECO       | 128        | [latest](https://tokens.r2d2.to/latest/128/tokens.json)        | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/128/tokens.json)        |
| Conflux    | 1030       | [latest](https://tokens.r2d2.to/latest/1030/tokens.json)       | [token-list](https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1030/tokens.json)       |

## Versions

| mask                                                  | mask_nft                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| [Latest](https://tokens.r2d2.to/latest/tokens.json)   | [Latest](https://tokens.r2d2.to/latest/non-fungible-tokens.json)   |
| [v0.0.28](https://tokens.r2d2.to/v0.0.28/tokens.json) | [v0.0.28](https://tokens.r2d2.to/v0.0.28/non-fungible-tokens.json) |
