const CI = {
  TOTAL: 1000,
  WAIT_TIME: 6000,
  CMC_WAIT_TIME: 500,
  CR_WAIT_TIME: 500,
  EXPLORER_LOOP_WAIT_TIME: 500,
  EXPLORER_PAGE_SIZE: 100,
  COIN_GEOKO_PAGE_SIZE: 250,
}

const DEV = {
  TOTAL: 1000,
  WAIT_TIME: 6000,
  CMC_WAIT_TIME: 500,
  CR_WAIT_TIME: 500,
  EXPLORER_LOOP_WAIT_TIME: 500,
  EXPLORER_PAGE_SIZE: 100,
  COIN_GEOKO_PAGE_SIZE: 250,
}

function getConfig() {
  return process.env.NODE_ENV === 'development' ? DEV : CI
}

export default getConfig
