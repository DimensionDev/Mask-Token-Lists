export async function imageChecker(url: string) {
  const result = await fetch(url, { method: 'HEAD' })
  return result.ok
}

export * from './file'
export * from './time'
