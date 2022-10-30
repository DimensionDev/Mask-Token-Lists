const CI = {
  total: 1000,
  EXPLORER_LOOP_WAIT_TIME: 500,
}

const DEV = {
  total: 20,
  EXPLORER_LOOP_WAIT_TIME: 500,
}

function getConfig() {
  return process.env.NODE_ENV === 'development' ? DEV : CI
}

export default getConfig
