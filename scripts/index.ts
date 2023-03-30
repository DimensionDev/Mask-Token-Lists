import { Command } from 'commander'
import { ChainId } from './type'
import { generate } from './commands/generate'
import Package from '../package.json'

const program = new Command()

program.name('mask-list-generator').description('CLI to generate token list').version(Package.version)

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
    console.log({ options, chains, target })
    generate(target)
  })

program.parse()
