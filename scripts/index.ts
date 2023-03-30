import { Command } from 'commander'
import { ChainId, FungibleToken } from './type'
import { generate } from './commands/generate'

const program = new Command()

program.name('mask-list-generator').description('CLI to generate token list').version('0.0.1')

program
  .command('generate')
  .description('Generate token list for chain(s)')
  .option('-i, --include <string>', 'The target chain to generate token list')
  .option('-e, --exclude <string>', 'The filtered target chain from all support chains to generate token list')
  .action((options) => {
    const chains = Object.values(ChainId) as ChainId[]

    const target = chains
      .filter((x) => (options.include ? x.toString() === options.include.toString() : true))
      .filter((x) => (options.exclude ? x.toString() !== options.exclude.toString() : true))

    generate(target)
  })

program.parse()
