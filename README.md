# Mask Token Lists

The token lists for Mask Network.

- List Name: Mask Network
- Link to the official homepage of the list manager: <https://mask.io>

## Setup

```bash
yarn install # install dependencies
yarn build # build token lists
```

## Steps for new chain

- Add the chain id in [types.ts](src/types.ts).
- Add your token lists into [src/fungible-tokens/](src/fungible-tokens/) or [src/non-fungible-tokens/](src/non-fungible-tokens/).
- Run `yarn build` to ensure everything is working great.
- Don't forget to bump version in `package.json`.
- Update below two tables in README file here.
- Rise a pull request in this repository.

## Versions based on chain id

<!-- begin versions -->

| Chain           |   Chain Id | Link                          | Viewer                               |
| --------------- | ---------: | ----------------------------- | ------------------------------------ |
| Mainnet         |          1 | [latest][link-mainnet]        | [token-list][viewer-mainnet]         |
| Ropsten         |          3 | [latest][link-ropsten]        | [token-list][viewer-ropsten]         |
| Rinkeby         |          4 | [latest][link-rinkeby]        | [token-list][viewer-rinkeby]         |
| Optimistic      |         10 | [latest][link-optimistic]     | [token-list][viewer-optimistic]      |
| Kardiachain     |         24 | [latest][link-kardiachain]    | [token-list][viewer-kardiachain]     |
| BNB             |         56 | [latest][link-bnb]            | [token-list][viewer-bnb]             |
| Chapel          |         97 | [latest][link-chapel]         | [token-list][viewer-chapel]          |
| xDai            |        100 | [latest][link-xdai]           | [token-list][viewer-xdai]            |
| Fuse            |        122 | [latest][link-fuse]           | [token-list][viewer-fuse]            |
| Heco            |        128 | [latest][link-heco]           | [token-list][viewer-heco]            |
| Fantom          |        250 | [latest][link-fantom]         | [token-list][viewer-fantom]          |
| Boba            |        288 | [latest][link-boba]           | [token-list][viewer-boba]            |
| Polygon         |        137 | [latest][link-polygon]        | [token-list][viewer-polygon]         |
| Mumbai          |      80001 | [latest][link-mumbai]         | [token-list][viewer-mumbai]          |
| Conflux         |       1030 | [latest][link-conflux]        | [token-list][viewer-conflux]         |
| Moonbeam        |       1284 | [latest][link-moonbeam]       | [token-list][viewer-moobeam]         |
| Arbiturm        |      42161 | [latest][link-arbiturm]       | [token-list][viewer-arbiturm]        |
| Celo            |      42220 | [latest][link-celo]           | [token-list][viewer-celo]            |
| Avalanche       |      43114 | [latest][link-avalanche]      | [token-list][viewer-avalanche]       |
| Aurora          | 1313161554 | [latest][link-aurora]         | [token-list][viewer-aurora]          |
| Harmony         | 1666600000 | [latest][link-harmony]        | [token-list][viewer-harmony]         |
| Harmony Testnet | 1666700000 | [latest][link-harmony-tesnet] | [token-list][viewer-harmony-testnet] |

[link-mainnet]: https://tokens.r2d2.to/latest/1/tokens.json
[link-ropsten]: https://tokens.r2d2.to/latest/3/tokens.json
[link-rinkeby]: https://tokens.r2d2.to/latest/4/tokens.json
[link-optimistic]: https://tokens.r2d2.to/latest/10/tokens.json
[link-bnb]: https://tokens.r2d2.to/latest/56/tokens.json
[link-chapel]: https://tokens.r2d2.to/latest/97/tokens.json
[link-xdai]: https://tokens.r2d2.to/latest/100/tokens.json
[link-fuse]: https://tokens.r2d2.to/latest/122/tokens.json
[link-heco]: https://tokens.r2d2.to/latest/128/tokens.json
[link-fantom]: https://tokens.r2d2.to/latest/250/tokens.json
[link-boba]: https://tokens.r2d2.to/latest/288/tokens.json
[link-polygon]: https://tokens.r2d2.to/latest/137/tokens.json
[link-mumbai]: https://tokens.r2d2.to/latest/80001/tokens.json
[link-conflux]: https://tokens.r2d2.to/latest/1030/tokens.json
[link-arbiturm]: https://tokens.r2d2.to/latest/42161/tokens.json
[link-celo]: https://tokens.r2d2.to/latest/42220/tokens.json
[link-avalanche]: https://tokens.r2d2.to/latest/43114/tokens.json
[link-aurora]: https://tokens.r2d2.to/latest/1313161554/tokens.json
[link-harmony]: https://tokens.r2d2.to/latest/1666600000/tokens.json
[link-harmony-testnet]: https://tokens.r2d2.to/latest/1666700000/tokens.json
[link-moonbeam]: https://tokens.r2d2.to/latest/1284/tokens.json
[link-kardiachain]: https://tokens.r2d2.to/latest/24/tokens.json
[viewer-mainnet]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1/tokens.json
[viewer-ropsten]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/3/tokens.json
[viewer-rinkeby]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/4/tokens.json
[viewer-optimistic]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/10/tokens.json
[viewer-bnb]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/56/tokens.json
[viewer-chapel]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/97/tokens.json
[viewer-xdai]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/100/tokens.json
[viewer-fuse]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/122/tokens.json
[viewer-heco]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/128/tokens.json
[viewer-fantom]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/250/tokens.json
[viewer-boba]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/288/tokens.json
[viewer-polygon]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/137/tokens.json
[viewer-mumbai]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/80001/tokens.json
[viewer-conflux]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1030/tokens.json
[viewer-arbiturm]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/42161/tokens.json
[viewer-celo]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/42220/tokens.json
[viewer-avalanche]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/43114/tokens.json
[viewer-aurora]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1313161554/tokens.json
[viewer-harmony]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1666600000/tokens.json
[viewer-harmony-testnet]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1666700000/tokens.json
[viewer-moonbeam]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/1284/tokens.json
[viewer-kardiachain]: https://tokenlists.org/token-list?url=https://tokens.r2d2.to/latest/24/tokens.json

<!-- end versions -->
